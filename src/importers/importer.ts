//@ts-ignore
import ImportWorker from "./importer.worker";
import type { Participant } from "index";
import { App, Notice, Setting } from "obsidian";
import type StatBlockPlugin from "src/main";
import { nanoid } from "src/util/util";
import FantasyStatblockModal from "src/modal/modal";

class SourcePromptModal extends FantasyStatblockModal {
    source: string;
    saved: boolean = false;
    display() {
        this.titleEl.createSpan({ text: "Set Sources" });
        new Setting(this.contentEl)
            .setName(
                "A source could not be found for some imported participants. Do you wish to manually add one?"
            )
            .addText((t) => {
                t.setPlaceholder("Unknown").onChange((v) => {
                    this.source = v;
                });
            });
        this.buildButtons(this.contentEl);
    }
    buildButtons(el: HTMLElement) {
        new Setting(el)
            .addButton((b) =>
                b
                    .setCta()
                    .setIcon("checkmark")
                    .setTooltip("Save")
                    .onClick(() => {
                        this.saved = true;
                        this.close();
                    })
            )
            .addExtraButton((b) =>
                b
                    .setIcon("cross")
                    .setTooltip("Cancel")
                    .onClick(() => {
                        this.close();
                    })
            );
    }
    onOpen() {
        this.display();
    }
}

const getSourceFromPrompt = async (app: StatBlockPlugin): Promise<string> => {
    return new Promise((resolve) => {
        const modal = new SourcePromptModal(app);
        modal.onClose = () => {
            if (!modal.saved) resolve(null);
            resolve(modal.source);
        };
        modal.open();
    });
};

export default class Importer {
    constructor(public plugin: StatBlockPlugin) {}
    workers: Map<string, Worker> = new Map();
    async import(files: FileList, source: string): Promise<Participant[]> {
        return new Promise((resolve) => {
            const worker = new ImportWorker();
            const id = nanoid();
            this.workers.set(id, worker);
            //@ts-ignore
            worker.onmessage = async (event) => {
                const { participants }: { participants: Participant[] } = event.data ?? {
                    participants: []
                };
                if (participants) {
                    new Notice(
                        `Successfully imported ${participants.length} participants`
                    );
                    const sourceless = participants.filter(
                        (participant) =>
                            participant.source == "Unknown" || !participant.source
                    );
                    let source: string;
                    if (
                        sourceless.length &&
                        (source = await getSourceFromPrompt(this.plugin))
                    ) {
                        sourceless.forEach(
                            (participant) => (participant.source = source)
                        );
                    }
                }
                worker.terminate();
                this.workers.delete(id);
                resolve(participants);
            }; //@ts-ignore
            worker.onerror = (e) => {
                new Notice(
                    `There was an error importing the file.\n\n${e.message}`
                );
                worker.terminate();
                this.workers.delete(id);
                resolve([]);
            };
            worker.postMessage({ files, source });
        });
    }
}
