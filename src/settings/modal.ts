import type { Participant } from "index";
import { Modal, Notice, Platform } from "obsidian";
import type StatBlockPlugin from "src/main";

import EditMonsterApp from "./EditParticipant.svelte";
import StatBlockRenderer from "src/view/statblock";
import FantasyStatblockModal from "src/modal/modal";

export class EditParticipantModal extends FantasyStatblockModal {
    private _instance: EditMonsterApp;
    constructor(
        plugin: StatBlockPlugin,
        private participant: Partial<Participant> = {}
    ) {
        super(plugin);
    }

    onOpen() {
        this._instance = new EditMonsterApp({
            target: this.contentEl,
            props: {
                participant: this.participant
            }
        });
        this._instance.$on("cancel", () => {
            this.close();
        });
        this._instance.$on("save", async ({ detail }: { detail: Participant }) => {
            if (!detail.name) {
                new Notice("Participants must be given a name.");
                return;
            }
            await this.plugin.updateParticipant(this.participant as Participant, detail);
            this.close();
        });
    }
    onClose() {}
    close() {
        if (this._instance) this._instance.$destroy();
        super.close();
    }
}

export class ViewParticipantModal extends FantasyStatblockModal {
    constructor(plugin: StatBlockPlugin, private participant: Participant) {
        super(plugin);
    }
    async display() {
        if (!Platform.isMobile) {
            this.contentEl.style.maxWidth = "85vw";
        }
        new StatBlockRenderer({
            container: this.contentEl,
            participant: this.participant,
            plugin: this.plugin
        });
    }
    onOpen() {
        this.display();
    }
}
