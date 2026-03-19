import fastCopy from "fast-copy";
import type { Participant } from "index";
import { Component, MarkdownRenderer } from "obsidian";
import type { HomebrewCreature } from "obsidian-overload";
import { Library } from "src/library/library";
import type StatBlockPlugin from "src/main";
import { LinkStringifier } from "src/parser/stringifier";
import StatBlockRenderer from "src/view/statblock";

declare global {
    interface Window {
        FantasyStatblocks: API;
    }
}

declare module "obsidian" {
    interface Workspace {
        on(name: "fantasy-statblocks:loaded", callback: () => void): EventRef;
        on(
            name: "fantasy-statblocks:bestiary:resolved",
            callback: () => void
        ): EventRef;
        on(
            name: "fantasy-statblocks:bestiary:updated",
            callback: () => void
        ): EventRef;
    }
}
export class API {
    #plugin: StatBlockPlugin;
    constructor(plugin: StatBlockPlugin) {
        this.#plugin = plugin;
    }

    getVersion(): {
        major: number;
        minor: number;
        patch: number;
    } {
        return this.#plugin.settings.version;
    }

    /**
     * Get the fully defined plugin library.
     *
     * @returns {Map<string, Participant>}
     */
    getLibrary() {
        return Library.getLibrary();
    }

    /**
     * Get a list of library participants.
     *
     * @returns {Participant[]}
     */
    getLibraryParticipants(): Participant[] {
        return Library.getLibraryParticipants();
    }

    /**
     * Get a list of library names.
     *
     * @returns {string[]}
     */
    getLibraryNames(): string[] {
        return Library.getLibraryNames();
    }

    /**
     * Returns true if the library contains the creature.
     *
     * @param {string} name
     * @returns {boolean}
     */
    hasCreature(name: string): boolean {
        return Library.hasCreature(name);
    }

    /**
     * Retrieve a fully defined participant out of the library, resolving all extensions.
     *
     * @param {string} name Name of the creautre to retrieve.
     * @returns {Partial<Participant> | null} The participant from the library, or null if not present.
     */
    getCreatureFromBestiary(name: string): Partial<Participant> | null {
        return Library.getCreatureFromBestiarySync(name);
    }
    /**
     * Retrieve a fully defined participant out of the library, resolving all extensions.
     *
     * @param {string} name Name of the creautre to retrieve.
     * @returns {Partial<Participant> | null} The participant from the library, or null if not present.
     */
    async getCreature(name: string): Promise<Partial<Participant> | null> {
        return await Library.getCreatureFromBestiary(name);
    }

    /**
     * Gets an array of participants sorted by the specified field.
     *
     * @param {string} field - The field by which participants should be sorted.
     * @returns {Array<Participant>} - An array of participants sorted by the specified field.
     */
    getSortedBy(field: string): Array<Participant> {
        return Library.getSortedBy(field);
    }
    /**
     * Registers a callback to be invoked when participants are sorted by the specified field.
     *
     * @param {string} field - The field by which participants are sorted.
     * @param {(values: Array<Participant>) => void} cb - The callback function to be invoked when sorting occurs.
     * @returns {() => void} - A function that can be used to unregister the callback.
     */
    onSortedBy(
        field: string,
        cb: (values: Array<Participant>) => void
    ): () => void {
        return Library.onSortedBy(field, cb);
    }
    /**
     * Registers a custom sorter function for sorting participants by the specified field.
     *
     * @param {string} field - The field by which participants should be sorted.
     * @param {(a: Participant, b: Participant) => number} compareFn - The comparison function used for sorting.
     */
    registerSorter(
        field: string,
        compareFn: (a: Participant, b: Participant) => number
    ) {
        return Library.registerSorter(field, compareFn);
    }

    /**
     * Gets an array of indices.
     *
     * @returns {Array<string>} - An array of indices.
     */
    getIndices() {
        return Library.getIndices();
    }
    /**
     * Gets the index map for the specified field.
     *
     * @param {string} field - The field for which the index map is retrieved.
     * @returns {Map<string, Set<string>>} - The index map for the specified field.
     */
    getIndex(field: string): Map<string, Set<string>> {
        return Library.getIndex(field);
    }
    /**
     * Registers an index for the specified field.
     *
     * @param {string} field - The field for which the index is registered.
     */
    registerIndex(field: string) {
        return Library.registerIndex(field);
    }
    /**
     * Registers a callback to be invoked when the specified index is updated.
     *
     * @param {string} index - The index for which the callback is registered.
     * @param {() => void} callback - The callback function to be invoked when the index is updated.
     * @returns {() => void} - A function that can be used to unregister the callback.
     */
    onIndexUpdated(index: string, callback: () => void): () => void {
        return Library.onIndexUpdated(index, callback);
    }

    isResolved(): boolean {
        return Library.isResolved();
    }
    onResolved(callback: () => void) {
        return Library.onResolved(callback);
    }
    onUpdated(callback: () => void) {
        return Library.onUpdated(callback);
    }

    render(
        creature: HomebrewCreature,
        el: HTMLElement,
        display?: string
    ): Component {
        const participant: Participant = Object.assign<
            Partial<Participant>,
            HomebrewCreature
        >(
            {},
            fastCopy(this.getCreatureFromBestiary(creature.name ?? "") ?? {}),
            //@ts-ignore
            fastCopy(creature)
        ) as Participant;
        if (!participant) return new Component();
        if (display) {
            participant.name = display;
        }
        return new StatBlockRenderer({
            container: el,
            participant,
            plugin: this.#plugin,
            context: "STATBLOCK_RENDERER"
        });
    }

    //Links
    isStatblockLink(link: string): boolean {
        return LinkStringifier.isStatblockLink(link);
    }
    parseStatblockLink(link: string): string {
        return LinkStringifier.stringifyLinks(link);
    }
    /**
     * Replaces any already transformed links back into their original link type.
     * @param source
     * @returns {string} The corrected string.
     */
    stringifyLinks(source: string): string {
        return LinkStringifier.stringifyLinks(source);
    }
    /**
     * This method can be used to replace any markdown or wikilinks in a source, so that it
     * can safely be transformed into YAML.
     *
     * @param {string} source The string to be transformed.
     * @returns {string} A transformed source, with links replaced.
     */
    transformLinks(source: string): string {
        return LinkStringifier.transformSource(source);
    }

    /**
     * Renders markdown string to an HTML element using Obsidian's Markdown renderer.
     * @param markdown — The markdown source code
     * @param el — The element to append to
     * @param sourcePath — The normalized path of this markdown file, used to resolve relative internal links
     * @param component — A parent component to manage the lifecycle of the rendered child components.
     */
    renderMarkdown(
        markdown: string,
        el: HTMLElement,
        sourcePath = "",
        component = this.#plugin
    ): void {
        MarkdownRenderer.render(
            this.#plugin.app,
            markdown,
            el,
            sourcePath,
            component
        );
    }
}
