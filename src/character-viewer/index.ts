import type { Monster } from "index";
import {
    ItemView,
    type WorkspaceLeaf,
    debounce,
    ExtraButtonComponent,
    SearchComponent
} from "obsidian";
import { Bestiary } from "src/library/library";
import type StatBlockPlugin from "src/main";
import { MonsterSuggestionModal } from "src/util/participant";

export const CHARACTER_VIEWER = "ttx-character-cards-viewer";

export class CharacterViewer extends ItemView {
    topEl = this.contentEl.createDiv("character-viewer-top-pane");
    statblockEl = this.contentEl.createDiv("character-statblock-container");

    constructor(leaf: WorkspaceLeaf, public plugin: StatBlockPlugin) {
        super(leaf);
        this.load();
        this.containerEl.addClasses([
            "ttx-character-cards",
            "character-viewer-container"
        ]);
        this.containerEl.on(
            "mouseover",
            "a.internal-link",
            debounce((event) => {
                this.plugin.app.workspace.trigger("hover-link", {
                    event,
                    source: this.plugin.manifest.id,
                    hoverParent: this.leaf,
                    targetEl: event.target as HTMLAnchorElement,
                    linktext: (event.target as HTMLAnchorElement).dataset.href
                });
            }, 10)
        );
        this.containerEl.on("click", "a.internal-link", (ev) =>
            this.app.workspace.openLinkText(
                (ev.target as HTMLAnchorElement).dataset.href,
                "ttx-character-cards"
            )
        );
    }

    onload() {
        const search = new SearchComponent(this.topEl).setPlaceholder(
            "Find a participant"
        );
        const suggester = new MonsterSuggestionModal(
            this.plugin.app,
            search,
            Bestiary.getBestiaryCreatures()
        );
        Bestiary.onResolved(() => {
            suggester.items = Bestiary.getBestiaryCreatures();
        });
        suggester.onSelect(async (v) => {
            if (v) {
                await this.render(v.item);
                search.setValue("");
            }
        });
        new ExtraButtonComponent(this.topEl)
            .setIcon("cross")
            .setTooltip("Close Card")
            .onClick(async () => {
                await this.render();
                search.setValue("");
            });
    }

    async render(participant?: Partial<Monster>) {
        this.statblockEl.empty();
        if (!participant) {
            this.statblockEl.createEl("em", {
                text: "Select a participant to view their card."
            });
            return;
        }
        const statblock = this.plugin.api.render(participant, this.statblockEl);
        this.addChild(statblock);
    }

    getDisplayText(): string {
        return "Character Viewer";
    }

    getIcon(): string {
        return "user";
    }

    getViewType(): string {
        return CHARACTER_VIEWER;
    }
}
