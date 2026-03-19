import type { Participant } from "index";
import copy from "fast-copy";
import type { CachedMetadata, FrontMatterInfo } from "obsidian";
import { transformTraits } from "src/util/util";
import YAML from "yaml";
import { LinkStringifier } from "src/parser/stringifier";

interface FileDetails {
    path: string;
    basename: string;
    mtime: number;
}

interface IWorkerData {
    debug: boolean;
    queue: string[];
    file: {
        statblock: "frontmatter" | "inline";
        content: string;
        info: FrontMatterInfo;
        file: FileDetails;
    };
    get: string;
    done: string;
    update: {
        participant: Participant;
        path: string;
    };
    save: void;
    read: string;
    content: {
        path: string;
        content: string;
    };
}

interface WorkerMessage<T extends keyof IWorkerData> {
    type: T;
    data: IWorkerData[T];
}

export type WorkerData<T extends keyof IWorkerData> = IWorkerData[T];

export type DebugMessage = WorkerMessage<"debug">;
export type QueueMessage = WorkerMessage<"queue">;
export type FileCacheMessage = WorkerMessage<"file">;
export type GetFileCacheMessage = WorkerMessage<"get">;
export type FinishFileMessage = WorkerMessage<"done">;
export type UpdateEventMessage = WorkerMessage<"update">;
export type SaveMessage = WorkerMessage<"save">;

const ctx: Worker = self as any;

class Parser {
    queue: string[] = [];
    parsing: boolean = false;
    debug: boolean;

    constructor() {
        //Add Files to Queue
        ctx.addEventListener("message", (event: MessageEvent<QueueMessage>) => {
            if (event.data.type == "queue") {
                this.add(...event.data.data);

                if (this.debug) {
                    console.debug(
                        `Fantasy Statblocks: Received queue message for ${event.data.data.length} paths`
                    );
                }
            }
        });
        ctx.addEventListener("message", (event: MessageEvent<DebugMessage>) => {
            if (event.data.type == "debug") {
                this.debug = event.data.data;
            }
        });
    }
    add(...paths: string[]) {
        if (this.debug) {
            console.debug(
                `Fantasy Statblocks: Adding ${paths.length} paths to queue`
            );
        }
        this.queue.push(...paths);
        if (!this.parsing) this.parse();
    }
    processContent(content: string, file: FileDetails) {
        if (this.debug)
            console.debug(`Fantasy Statblocks: Process Content: ${file.path}`);
        let statBlock = this.findFirstStatBlock(content);
        if (statBlock) {
            if (this.debug)
                console.debug(
                    `Fantasy Statblocks: found Statblock: ${JSON.stringify(
                        statBlock
                    )}`
                );

            const frontmatter = LinkStringifier.transformSource(statBlock);
            const participant: Participant = Object.assign(
                {},
                YAML.parse(frontmatter),
                {
                    mtime: file.mtime
                }
            );
            if (this.debug)
                console.debug(`Fantasy Statblocks: ${JSON.stringify(participant)}`);
            this.processParticipant(participant, file);
        }
    }

    findFirstStatBlock(content: string): string {
        let matches = content.match(
            /^```[^\S\r\n]*statblock\s?\n([\s\S]+?)^```/m
        );
        if (matches) {
            return matches[1];
        }
        return null;
    }
    async parse() {
        this.parsing = true;
        while (this.queue.length) {
            const path = this.queue.shift();
            if (this.debug) {
                console.debug(
                    `Fantasy Statblocks: Parsing ${path} for statblocks (${this.queue.length} to go)`
                );
            }
            const event = await this.getFileData(path);

            if (!path.endsWith(".md")) {
                continue;
            }
            if (!event.data) continue;

            const { file, statblock } = event.data;

            try {
                if (statblock === "inline") {
                    //statblock codeblock
                    this.processContent(event.data.content, file);
                } else {
                    //frontmatter
                    this.parseFrontmatter(event.data.info, file);
                }
            } catch (e) {
                console.error(
                    `There was an error parsing the Statblock in ${path}: \n\n${e.message}`
                );
            }

            ctx.postMessage<FinishFileMessage>({ type: "done", data: path });
        }
        this.parsing = false;
        ctx.postMessage<SaveMessage>({ type: "save", data: null });
    }

    async getFileData(path: string): Promise<FileCacheMessage | null> {
        return new Promise((resolve) => {
            ctx.addEventListener(
                "message",
                (event: MessageEvent<FileCacheMessage | null>) => {
                    if (event.data.type == "file") {
                        resolve(event.data);
                    }
                }
            );
            ctx.postMessage<GetFileCacheMessage>({ data: path, type: "get" });
        });
    }
    parseFrontmatter(info: FrontMatterInfo, file: FileDetails) {
        if (!info.exists) return;

        const frontmatter = LinkStringifier.transformYamlSource(
            info.frontmatter
        );

        const participant: Participant = this.validate(
            Object.assign({}, copy(YAML.parse(frontmatter)), {
                mtime: file.mtime
            })
        );

        if (participant.traits) {
            participant.traits = transformTraits([], participant.traits);
        }
        this.processParticipant(participant, file);
    }

    private processParticipant(participant: Participant, file: FileDetails) {
        if (participant.actions) {
            participant.actions = transformTraits([], participant.actions);
        }
        if (participant.bonus_actions) {
            participant.bonus_actions = transformTraits([], participant.bonus_actions);
        }
        if (participant.reactions) {
            participant.reactions = transformTraits([], participant.reactions);
        }
        if (participant.legendary_actions) {
            participant.legendary_actions = transformTraits(
                [],
                participant.legendary_actions
            );
        }
        if (
            participant["statblock-link"] &&
            participant["statblock-link"].startsWith("#")
        ) {
            participant[
                "statblock-link"
            ] = `[${participant.name}](${file.path}${participant["statblock-link"]})`;
        }

        if (this.debug)
            console.debug(
                `Fantasy Statblocks: Adding ${participant.name} to library from ${file.basename}`
            );

        ctx.postMessage<UpdateEventMessage>({
            type: "update",
            data: { participant, path: file.path }
        });
    }
    validate(draft: Partial<Participant>): Participant {
        return draft as Participant;
    }
}
new Parser();
