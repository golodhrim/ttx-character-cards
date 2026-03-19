import {
    addIcon,
    MarkdownPostProcessorContext,
    Notice,
    ObsidianProtocolHandler,
    parseYaml,
    Plugin,
    WorkspaceLeaf
} from "obsidian";
import domtoimage from "dom-to-image";

import StatBlockRenderer from "./view/statblock";
import { nanoid } from "./util/util";
import type { Participant, StatblockParameters } from "../index";
import StatblockSettingTab from "./settings/settings";
import fastCopy from "fast-copy";

import type { HomebrewCreature } from "obsidian-overload";
import type {
    DefaultLayout,
    Layout,
    StatblockItem
} from "./layouts/layout.types";
import { LayoutTTXPlayerCard } from "./layouts/ttx/ttx-player-card";
import { StatblockSuggester } from "./suggest";
import { DefaultLayouts } from "./layouts";
import type { StatblockData } from "index";
import LayoutManager from "./layouts/manager";
import { CHARACTER_VIEWER, CharacterViewer } from "./character-viewer";
import { API } from "./api/api";
import { Linkifier } from "./parser/linkify";
import { Library } from "./library/library";
import { ExpectedValue } from "@javalent/dice-roller";

export const DICE_ROLLER_SOURCE = "FANTASY_STATBLOCKS_PLUGIN";

const DEFAULT_DATA: StatblockData = {
    participants: [],
    defaultLayouts: {},
    layouts: [],
    default: LayoutTTXPlayerCard.name,
    useDice: true,
    renderDice: false,
    export: true,
    showAdvanced: false,
    version: {
        major: null,
        minor: null,
        patch: null
    },
    paths: ["/"],
    autoParse: false,
    disableSRD: false,
    tryToRenderLinks: true,
    debug: false,
    notifiedOfFantasy: false,
    hideConditionHelp: false,
    alwaysImport: false,
    defaultLayoutsIntegrated: false,
    atomicWrite: false
};

export default class StatBlockPlugin extends Plugin {
    settings: StatblockData;
    manager = new LayoutManager();
    api: API = new API(this);

    getRoller(str: string) {
        if (!this.canUseDiceRoller) return;
        const roller = window.DiceRoller.getRollerSync(str, DICE_ROLLER_SOURCE);
        return roller;
    }
    getRollerString(str: string) {
        if (!this.canUseDiceRoller) return str;
        return window.DiceRoller.getRollerString(str, DICE_ROLLER_SOURCE);
    }
    get diceRollerInstalled() {
        if (window.DiceRoller != null) {
            return true;
        }
        return false;
    }
    get canUseDiceRoller() {
        if (this.diceRollerInstalled) {
            return this.settings.useDice;
        }
        return false;
    }

    get creature_view() {
        const leaves = this.app.workspace.getLeavesOfType(CHARACTER_VIEWER);
        const leaf = leaves?.length ? leaves[0] : null;
        if (leaf && leaf.view && leaf.view instanceof CharacterViewer)
            return leaf.view;
    }
    async openCharacterViewer(newPane: boolean = false) {
        let leaf: WorkspaceLeaf;
        const existing = this.app.workspace.getLeavesOfType(CHARACTER_VIEWER);

        if (!newPane && existing?.length) {
            leaf = existing.shift();
        } else {
            if (newPane && existing?.length) {
                leaf = this.app.workspace.createLeafInParent(
                    existing[0].parent,
                    existing[0].parent.children.length
                );
            } else {
                leaf = this.app.workspace.getRightLeaf(true);
            }
            await leaf.setViewState({
                type: CHARACTER_VIEWER
            });
        }
        this.app.workspace.revealLeaf(leaf);
        return leaf.view as CharacterViewer;
    }

    #creaturePaneProtocolHandler: ObsidianProtocolHandler = (data) => {
        const name = data?.creature ?? data?.name ?? "";

        if (Library.hasCreature(name)) {
            const creature = Library.get(name);
            if (!this.creature_view) {
                this.openCharacterViewer().then((v) => v.render(creature));
            } else {
                this.creature_view.render(creature);
            }
        }
    };
    async onload() {
        console.log("Fantasy StatBlocks loaded");
        this.app.workspace.trigger("fantasy-statblocks:loaded", null);

        await this.loadSettings();
        await this.saveSettings();

        this.manager.initialize(this.settings);
        this.register(() => this.manager.unload());

        Library.initialize(this);
        Linkifier.initialize(this.app.metadataCache, this.app);

        this.register(() => Linkifier.unload());

        this.registerHoverLinkSource(this.manifest.id, {
            display: this.manifest.name,
            defaultMod: false
        });

        this.addCommand({
            id: "open-creature-view",
            name: "Open Creature pane",
            checkCallback: (checking) => {
                const existing =
                    this.app.workspace.getLeavesOfType(CHARACTER_VIEWER);
                if (!existing.length) {
                    if (!checking) {
                        this.openCharacterViewer();
                    }
                    return true;
                }
                return false;
            }
        });
        this.addCommand({
            id: "reveal-creature-view",
            name: "Reveal Creature pane",
            checkCallback: (checking) => {
                const existing =
                    this.app.workspace.getLeavesOfType(CHARACTER_VIEWER);
                if (existing.length) {
                    if (!checking) {
                        this.openCharacterViewer();
                    }
                    return true;
                }
                return false;
            }
        });
        this.addCommand({
            id: "open-new-creature-view",
            name: "Open new Creature pane",
            callback: () => {
                this.openCharacterViewer(true);
            }
        });
        this.addRibbonIcon("skull", "Open Creature pane", async (evt) => {
            this.openCharacterViewer(evt.getModifierState("Meta"));
        });

        this.registerObsidianProtocolHandler(
            "creature-pane",
            this.#creaturePaneProtocolHandler.bind(this)
        );

        addIcon(
            "markdown-icon",
            `<svg fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512"><!--! Font Awesome Pro 6.2.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M593.8 59.1H46.2C20.7 59.1 0 79.8 0 105.2v301.5c0 25.5 20.7 46.2 46.2 46.2h547.7c25.5 0 46.2-20.7 46.1-46.1V105.2c0-25.4-20.7-46.1-46.2-46.1zM338.5 360.6H277v-120l-61.5 76.9-61.5-76.9v120H92.3V151.4h61.5l61.5 76.9 61.5-76.9h61.5v209.2zm135.3 3.1L381.5 256H443V151.4h61.5V256H566z"/></svg>`
        );

        this.addSettingTab(new StatblockSettingTab(this.app, this));

        (window["TTXCharacterCards"] = this.api) &&
            this.register(() => delete window["TTXCharacterCards"]);

        this.registerMarkdownCodeBlockProcessor(
            "statblock",
            this.postprocessor.bind(this)
        );

        this.registerEditorSuggest(new StatblockSuggester(this));

        this.registerView(
            CHARACTER_VIEWER,
            (leaf: WorkspaceLeaf) => new CharacterViewer(leaf, this)
        );
        if (this.canUseDiceRoller) {
            window.DiceRoller.registerSource(DICE_ROLLER_SOURCE, {
                showDice: true,
                shouldRender: this.settings.renderDice,
                showFormula: false,
                showParens: false,
                expectedValue: ExpectedValue.Average,
                text: null
            });
        }
        this.registerEvent(
            this.app.workspace.on("dice-roller:loaded", () => {
                window.DiceRoller.registerSource(DICE_ROLLER_SOURCE, {
                    showDice: true,
                    shouldRender: this.settings.renderDice,
                    showFormula: false,
                    showParens: false,
                    expectedValue: ExpectedValue.Average,
                    text: null
                });
            })
        );
    }

    async loadSettings() {
        const settings: StatblockData = await this.loadData();
        this.settings = {
            ...DEFAULT_DATA,
            ...settings
        };
        if (!this.settings.defaultLayoutsIntegrated) {
            for (const layout of this.settings.layouts) {
                layout.id = nanoid();
            }
            this.settings.default = (
                this.layouts.find(
                    ({ name }) => name == this.settings.default
                ) ?? LayoutTTXPlayerCard
            ).id;

            this.settings.defaultLayoutsIntegrated = true;
        }
        if (Array.isArray(this.settings.defaultLayouts)) {
            const map: Record<string, DefaultLayout> = {};
            for (const layout of this.settings
                .defaultLayouts as DefaultLayout[]) {
                if (layout.removed || layout.edited) {
                    map[layout.id] = layout;
                }
            }
            this.settings.defaultLayouts = map;
        }
        for (const layout of DefaultLayouts) {
            if (!(layout.id in this.settings.defaultLayouts)) continue;
            if (layout.version == null) continue;
            const existing = this.settings.defaultLayouts[layout.id];
            if (existing.version >= layout.version) continue;
            if (existing.edited) {
                existing.updatable = true;
                continue;
            }
            existing.blocks = fastCopy(layout.blocks);
        }

        function fixSpells(...blocks: StatblockItem[]) {
            for (const block of blocks) {
                if (block.type == "spells") {
                    if (!block.properties.length)
                        block.properties.push("spells");
                }
                if ("nested" in block) {
                    fixSpells(...block.nested);
                }
            }
        }
        for (const layout of this.settings.layouts) {
            fixSpells(...layout.blocks);
        }

        const version = this.manifest.version.split(".");
        this.settings.version = {
            major: Number(version[0]),
            minor: Number(version[1]),
            patch: Number(version[2])
        };
    }
    async saveSettings() {
        this.app.workspace.trigger(
            "fantasy-statblocks:settings-change",
            this.settings
        );
        await this.saveData(this.settings);
    }
    async loadData(): Promise<StatblockData> {
        return (await super.loadData()) as StatblockData;
    }
    async saveData(settings: StatblockData) {
        /* if (this.settings.atomicWrite) {
            try {
                await this.app.vault.adapter.write(
                    `${this.manifest.dir}/temp.json`,
                    JSON.stringify(settings, null, null)
                );

                await this.app.vault.adapter.remove(
                    `${this.manifest.dir}/data.json`
                );
                await this.app.vault.adapter.rename(
                    `${this.manifest.dir}/temp.json`,
                    `${this.manifest.dir}/data.json`
                );
            } catch (e) {
                super.saveData(settings);
            }
        } else { */
        super.saveData(settings);
        /* } */
    }

    async saveParticipant(participant: Participant, save: boolean = true) {
        if (!participant.name) return;
        if (Library.isLocal(participant.name)) {
            //already exists, replace it
            const index = this.settings.participants.findIndex(
                ([name]) => name === participant.name
            );
            if (index >= 0) {
                this.settings.participants.splice(index, 1, [
                    participant.name,
                    participant
                ]);
            } else {
                this.settings.participants.push([participant.name, participant]);
            }
        } else {
            this.settings.participants.push([participant.name, participant]);
        }
        Library.addLocalCreature(participant);

        if (save) {
            await this.saveSettings();
        }
    }
    async saveParticipants(participants: Participant[]) {
        for (let participant of participants) {
            await this.saveParticipant(participant, false);
        }
        await this.saveSettings();
    }

    async updateParticipant(oldParticipant: Participant, newParticipant: Participant) {
        await this.deleteParticipants(oldParticipant.name);
        await this.saveParticipant(newParticipant);
    }

    async deleteParticipants(...participants: string[]) {
        for (let participant of participants) {
            Library.removeLocalCreature(participant);
        }
        this.settings.participants = this.settings.participants.filter(
            ([name]) => !participants.includes(name)
        );
        await this.saveSettings();
    }

    onunload() {
        console.log("Fantasy StatBlocks unloaded");

        this.app.workspace
            .getLeavesOfType(CHARACTER_VIEWER)
            .forEach((leaf) => leaf.detach());
    }

    exportAsPng(name: string, containerEl: Element) {
        function filter(node: HTMLElement) {
            return !node.hasClass || !node.hasClass("clickable-icon");
        }
        const content =
            containerEl.querySelector<HTMLDivElement>(".statblock-content");
        if (content) delete content.style["boxShadow"];
        domtoimage
            .toPng(containerEl, {
                filter: filter,
                style: { height: "100%" }
            })
            .then((url) => {
                const link = document.createElement("a");
                link.download = name + ".png";
                link.href = url;
                link.click();
                link.detach();
            })
            .catch((e) => {
                new Notice(
                    `There was an error creating the image: \n\n${e.message}`
                );
                console.error(e);
            });
    }

    get layouts() {
        return this.manager.getAllLayouts();
    }

    get defaultLayout() {
        return this.manager.getDefaultLayout();
    }

    getLayoutOrDefault(participant: Participant): Layout {
        return this.manager.getLayoutOrDefault(participant.layout);
    }

    async postprocessor(
        source: string,
        el: HTMLElement,
        ctx: MarkdownPostProcessorContext
    ) {
        try {
            /** Replace Links */
            source = Linkifier.transformSource(source);

            /** Get Parameters */
            let params: StatblockParameters = parseYaml(source);

            el.addClass("statblock-plugin-container");
            el.parentElement?.addClass("statblock-plugin-parent");

            let statblock = new StatBlockRenderer({
                container: el,
                plugin: this,
                params,
                context: ctx.sourcePath
            });

            ctx.addChild(statblock);
        } catch (e) {
            console.error(`Obsidian Statblock Error:\n${e}`);
            let pre = createEl("pre");
            pre.setText(`\`\`\`statblock
There was an error rendering the statblock:
${e.stack
    .split("\n")
    .filter((line: string) => !/^at/.test(line?.trim()))
    .join("\n")}
\`\`\``);
        }
    }
    //backwards-compat
    render(creature: HomebrewCreature, el: HTMLElement, display?: string) {
        this.api.render(creature, el, display);
    }
}
