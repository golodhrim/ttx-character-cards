import {
    App,
    ButtonComponent,
    Modal,
    TFile,
    getFrontMatterInfo,
    parseYaml,
    stringifyYaml
} from "obsidian";
import { LayoutTTXPlayerCard } from "src/layouts/ttx/ttx-player-card";
import { MarkdownRenderChild } from "obsidian";
import type { Participant, StatblockParameters, Trait } from "../../index";

import Statblock from "./Statblock.svelte";
import type StatBlockPlugin from "src/main";

import fastCopy from "fast-copy";
import type {
    CollapseItem,
    GroupItem,
    IfElseItem,
    InlineItem,
    JavaScriptItem,
    Layout,
    LayoutItem,
    StatblockItem
} from "src/layouts/layout.types";
import { append } from "src/util/util";
import { Linkifier } from "src/parser/linkify";
import { Library } from "src/library/library";
import copy from "fast-copy";

type RendererParameters = {
    container: HTMLElement;
    plugin: StatBlockPlugin;
    context?: string;
    layout?: Layout;
} & (
    | {
          participant: Participant;
      }
    | {
          params: Partial<StatblockParameters>;
      }
);

export default class StatBlockRenderer extends MarkdownRenderChild {
    topBar!: HTMLDivElement;
    bottomBar!: HTMLDivElement;
    loaded: boolean = false;
    statblockEl!: HTMLDivElement;
    contentEl!: HTMLDivElement;
    container: HTMLElement;
    participant!: Participant;
    plugin: StatBlockPlugin;
    params!: Partial<StatblockParameters>;
    context: string;
    layout!: Layout;
    constructor(
        public rendererParameters: RendererParameters,
        public icons = true
    ) {
        super(rendererParameters.container);

        this.container = rendererParameters.container;
        this.plugin = rendererParameters.plugin;
        this.context = rendererParameters.context ?? "";

        this.setCreature(rendererParameters);

        this.setLayout();

        this.init();
    }
    setLayout() {
        this.layout =
            this.rendererParameters.layout ??
            this.plugin.manager
                .getAllLayouts()
                .find(
                    (layout) =>
                        layout.name ==
                            (this.params.layout ?? this.participant.layout) ||
                        layout.name ==
                            (this.params.statblock ?? this.participant.statblock)
                ) ??
            this.plugin.manager.getDefaultLayout();
    }
    get canSave() {
        return "name" in this.params;
    }

    async build(): Promise<Participant> {
        let built: Partial<Participant> = Object.assign(
            {},
            this.participant ?? {},
            this.params ?? {}
        );

        if (!Object.values(built).length) {
            built = Object.assign({}, built, {
                note: this.context
            });
        }
        if (built.note) {
            const note = Array.isArray(built.note)
                ? (<string[]>built.note).flat(Infinity).pop()
                : built.note;
            const file =
                await this.plugin.app.metadataCache.getFirstLinkpathDest(
                    `${note}`,
                    this.context ?? ""
                );
            if (file && file instanceof TFile) {
                const info = getFrontMatterInfo(
                    await this.plugin.app.vault.cachedRead(file)
                );
                if (info.exists) {
                    Object.assign(
                        built,
                        fastCopy(
                            parseYaml(
                                Linkifier.transformYamlSource(info.frontmatter)
                            ) ?? {}
                        ),
                        this.params
                    );
                }
            }
        }
        if ("image" in built) {
            if (Array.isArray(built.image)) {
                built.image = built.image.flat(2).join("");
            }
        }

        const extensions = Library.getExtensions(built, new Set());
        /**
         * At this point, the built creature has been fully resolved from all
         * extensions and in-memory creature definitions.
         */
        for (const extension of extensions.reverse()) {
            built = Object.assign(built, extension);
        }
        built = Object.assign(built, this.participant ?? {}, this.params ?? {});

        /**
         * Traits logic:
         * Defined in Params: ALWAYS SHOW
         * then, defined in memory
         * then, defined via extension
         *
         * Traits defined using `trait+: ...` will always just add to the underlying trait.
         */

        for (const block of this.unwrapBlocks(this.layout.blocks)) {
            if (!("properties" in block)) continue;
            for (let property of block.properties) {
                /** Ignore properties that aren't in the final built creature. */
                if (
                    !(property in built) &&
                    !(`${property}+` in built) &&
                    !(`${property}-` in built)
                ) {
                    continue;
                }
                switch (block.type) {
                    case "traits": {
                        /**
                         * Traits can be defined directly, as additive (+) or subtractive (-).
                         *
                         * Directly defined traits can be overidden by name up the extension tree.
                         * Parameters > `creature` > `extends`
                         * Directly defined parameter traits are *always shown*.
                         *
                         * Additive traits are *always* displayed, no matter where they originate.
                         *
                         * Subtractive traits are *always* removed, unless the trait is directly defined in the parameters.
                         * Subtractive traits only work on directly defined traits.
                         *
                         */
                        const $TRAIT_MAP: Map<string, Trait> = new Map();
                        const $ADDITIVE_TRAITS: Trait[] = [];

                        /**
                         * Resolve extension traits first.
                         */
                        for (const creature of [...extensions]) {
                            /**
                             * Directly defined traits.
                             *
                             * Because these can be overridden, they go into a map by name.
                             */
                            for (const trait of getTraitsList(
                                property,
                                creature
                            )) {
                                $TRAIT_MAP.set(trait.name, trait);
                            }

                            /**
                             * Deleted traits. These are always removed.
                             */
                            for (const trait of getTraitsList(
                                `${property}-` as keyof Participant,
                                creature
                            )) {
                                $TRAIT_MAP.delete(trait.name);
                            }

                            /**
                             * Modifiable traits. These traits modify existing traits by name.
                             * If the trait does not exist, it is ignored.
                             */

                            for (const trait of getTraitsList(
                                `${property}~` as keyof Participant,
                                creature
                            )) {
                                if ($TRAIT_MAP.has(trait.name)) {
                                    $TRAIT_MAP.set(trait.name, trait);
                                }
                            }

                            /**
                             * Additive traits. These traits are always shown.
                             */
                            for (const trait of getTraitsList(
                                `${property}+` as keyof Participant,
                                creature
                            )) {
                                $ADDITIVE_TRAITS.push(trait);
                            }
                        }
                        Object.assign(built, {
                            [property]: [
                                ...$TRAIT_MAP.values(),
                                ...$ADDITIVE_TRAITS
                            ]
                        });
                        break;
                    }
                    case "saves": {
                        /** TODO: Reimplement combinatorial saves */
                        let saves: {
                            [x: string]: any;
                        }[] =
                            (built[property] as {
                                [x: string]: any;
                            }[]) ?? [];
                        if (
                            property in built &&
                            !Array.isArray(built[property]) &&
                            typeof built[property] == "object"
                        ) {
                            saves = Object.entries(built[property] ?? {}).map(
                                ([key, value]) => {
                                    return { [key]: value };
                                }
                            );
                        }
                        Object.assign(built, {
                            [property]: saves
                        });
                        let additive: {
                            [x: string]: any;
                        }[] = [];
                        if (
                            `${property}+` in built &&
                            !Array.isArray(
                                built[`${property}+` as keyof Participant]
                            ) &&
                            typeof built[`${property}+` as keyof Participant] ==
                                "object"
                        ) {
                            additive = Object.entries(
                                built[property] ?? {}
                            ).map(([key, value]) => {
                                return { [key]: value };
                            });
                        }
                        if (additive.length) {
                            Object.assign(built, {
                                [property]: append(
                                    built[property] as { [x: string]: any }[],
                                    additive
                                )
                            });
                        }
                        break;
                    }
                    default: {
                        if (`${property}+` in built && property in built) {
                            const additive = append(
                                built[property] as string | any[],
                                built[`${property}+` as keyof Participant] as
                                    | string
                                    | any[]
                            );
                            if (additive) {
                                Object.assign(built, {
                                    [property]: additive
                                });
                            }
                        }
                    }
                }
            }
        }

        built = this.transformLinks(built);

        if ("image" in built && Array.isArray(built.image)) {
            built.image = built.image.flat(2).join("");
        }

        return built as Participant;
    }

    /**
     * This is used to return a list of "saves" or "traits" block in the layout.
     */
    unwrapBlocks(
        blocks: StatblockItem[]
    ): Exclude<
        StatblockItem,
        | GroupItem
        | InlineItem
        | IfElseItem
        | JavaScriptItem
        | CollapseItem
        | LayoutItem
    >[] {
        let ret: Exclude<
            StatblockItem,
            | GroupItem
            | InlineItem
            | IfElseItem
            | JavaScriptItem
            | CollapseItem
            | LayoutItem
        >[] = [];
        for (const block of blocks) {
            switch (block.type) {
                case "group":
                case "inline":
                case "collapse": {
                    ret.push(...this.unwrapBlocks(block.nested));
                    break;
                }
                case "layout":
                case "ifelse":
                case "javascript": {
                    continue;
                }
                default:
                    ret.push(block);
                    break;
            }
        }

        return ret;
    }

    setCreature(
        params:
            | {
                  participant: Participant;
              }
            | {
                  params: Partial<StatblockParameters>;
              }
    ) {
        if ("params" in params) {
            this.params = params.params;
            this.participant = Object.assign(
                {},
                Library.get(this.params.participant) ??
                    Library.get(this.params.creature)
            );
        } else {
            this.params = {};
            this.participant = params.participant;
        }
    }

    $ui!: Statblock;
    async init() {
        this.containerEl.empty();
        this.participant = (await this.build()) as Participant;
        this.$ui = new Statblock({
            target: this.containerEl,
            props: {
                context: this.context,
                participant: this.participant,
                statblock: this.layout.blocks,
                layout: this.layout,
                plugin: this.plugin,
                renderer: this,
                canSave: this.canSave,
                icons: this.icons ?? true
            }
        });
        this.$ui.$on("save", async () => {
            if (
                Library.hasCreature(this.participant.name) &&
                !(await confirmWithModal(
                    this.plugin.app,
                    "This will overwrite an existing participant in settings. Are you sure?"
                ))
            )
                return;
            this.plugin.saveParticipant({
                ...fastCopy(this.participant),
                source: this.participant.source ?? "Homebrew",
                layout: this.layout.name
            } as Participant);
        });

        this.$ui.$on("export", () => {
            this.plugin.exportAsPng(
                this.participant.name,
                this.containerEl.firstElementChild!
            );
        });

        let extensionNames = Library.getExtensionNames(
            this.participant,
            new Set()
        );
        this.plugin.registerEvent(
            this.plugin.app.workspace.on(
                "fantasy-statblocks:bestiary:creature-added",
                async (creature) => {
                    if (extensionNames.includes(creature.name)) {
                        this.participant = copy(creature);
                        this.participant = await this.build();
                        this.$ui.$set({ participant: this.participant });
                    }
                }
            )
        );
    }
    transformLinks(participant: Partial<Participant>): Partial<Participant> {
        const built = parseYaml(
            Linkifier.transformYamlSource(
                stringifyYaml(participant).replace(/\\#/g, "#")
            )
        );
        return built;
    }
}

export async function confirmWithModal(
    app: App,
    text: string,
    buttons: { cta: string; secondary: string } = {
        cta: "Yes",
        secondary: "No"
    }
): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const modal = new ConfirmModal(app, text, buttons);
        modal.onClose = () => {
            resolve(modal.confirmed);
        };
        modal.open();
    });
}

export class ConfirmModal extends Modal {
    constructor(
        app: App,
        public text: string,
        public buttons: { cta: string; secondary: string }
    ) {
        super(app);
    }
    confirmed: boolean = false;
    async display() {
        new Promise((resolve) => {
            this.contentEl.empty();
            this.contentEl.addClass("confirm-modal");
            this.contentEl.createEl("p", {
                text: this.text
            });
            const buttonEl = this.contentEl.createDiv(
                "fantasy-calendar-confirm-buttons"
            );
            new ButtonComponent(buttonEl)
                .setButtonText(this.buttons.cta)
                .setCta()
                .onClick(() => {
                    this.confirmed = true;
                    this.close();
                });
            new ButtonComponent(buttonEl)
                .setButtonText(this.buttons.secondary)
                .onClick(() => {
                    this.close();
                });
        });
    }
    onOpen() {
        this.display();
    }
}

function getTraitsList(
    property: keyof Participant,
    obj: Partial<Participant>
): Trait[] {
    const traitArray: Trait[] = [];
    if (property in obj && Array.isArray(obj[property])) {
        for (const trait of obj[property] as any[]) {
            if (
                !Array.isArray(trait) &&
                typeof trait == "object" &&
                "name" in trait
            ) {
                traitArray.push(trait);
            }
            if (Array.isArray(trait) && trait.length >= 1) {
                traitArray.push({
                    name: trait[0],
                    desc: trait.slice(1).join("")
                });
            }
        }
    }
    return traitArray;
}
