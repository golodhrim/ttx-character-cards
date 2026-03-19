import fastCopy from "fast-copy";
import type { Participant } from "index";
import type StatBlockPlugin from "src/main";
import { Watcher } from "src/watcher/watcher";
import { SRD_LIBRARY_BY_NAME } from "./srd-library";
import { stringify } from "src/util/util";
import type { EventRef, Events, Workspace } from "obsidian";

declare module "obsidian" {
    interface Workspace {
        trigger(name: "fantasy-statblocks:bestiary:resolved"): void;
        trigger(name: "fantasy-statblocks:bestiary:updated"): void;
        trigger(
            name: "fantasy-statblocks:bestiary:creature-added",
            creature: Participant
        ): void;
        trigger<T extends string>(
            name: `fantasy-statblocks:bestiary:indexed:${T}`
        ): void;
        trigger<T extends string>(
            name: `fantasy-statblocks:bestiary:sorted:${T}`,
            values: Array<Participant>
        ): void;
        on(
            name: `fantasy-statblocks:bestiary:creature-added`,
            callback: (creature: Participant) => void
        ): EventRef;
        on<T extends string>(
            name: `fantasy-statblocks:bestiary:indexed:${T}`,
            callback: () => void
        ): EventRef;
        on<T extends string>(
            name: `fantasy-statblocks:bestiary:sorted:${T}`,
            callback: (values: Array<Participant>) => void
        ): EventRef;
    }
}

class LibraryClass {
    #library: Map<string, Participant> = new Map();
    #local: Map<string, Participant> = new Map();
    #ephemeral: Map<string, Participant> = new Map();

    #resolved = false;

    enableSRD: boolean;

    #indices: Map<string, Map<string, Set<string>>> = new Map();

    #sorters: Map<string, (a: Participant, b: Participant) => number> = new Map();
    #sorted: Map<string, Array<Participant>> = new Map();

    getSortedBy(field: string): Array<Participant> {
        return this.#sorted.get(field) ?? [];
    }
    onSortedBy(
        field: string,
        cb: (values: Array<Participant>) => void
    ): () => void {
        let ref = this.#events.on(
            `fantasy-statblocks:bestiary:sorted:${field}`,
            (values) => cb(values)
        );

        return () => {
            this.#events.offref(ref);
        };
    }

    registerSorter(
        field: string,
        compareFn: (a: Participant, b: Participant) => number
    ) {
        if (!this.#sorters.has(field)) {
            this.#sorters.set(field, compareFn);
        }
        this.#triggerSort(field);
    }

    #triggerSort(...fields: string[]) {
        if (!this.isResolved()) return;
        setTimeout(() => {
            for (const field of fields && fields.length
                ? fields
                : [...this.#sorters.keys()]) {
                this.#sorted.set(
                    field,
                    this.getLibraryParticipants().sort((a, b) =>
                        this.#sorters.get(field)(a, b)
                    )
                );
                this.#events.trigger(
                    `fantasy-statblocks:bestiary:sorted:${field}`,
                    this.getSortedBy(field)
                );
            }
        }, 0);
    }

    getIndices() {
        return this.#indices;
    }
    getIndex(field: string): Map<string, Set<string>> {
        return this.#indices.get(field) ?? new Map();
    }
    registerIndex(field: string) {
        if (this.#indices.has(field)) return;
        this.#indices.set(field, new Map());
    }

    onIndexUpdated(index: string, callback: () => void): () => void {
        if (!this.#indices.has(index)) return () => {};
        let ref: EventRef = this.#events.on(
            `fantasy-statblocks:bestiary:indexed:${index}`,
            () => callback()
        );

        return () => {
            this.#events.offref(ref);
        };
    }
    #events: Workspace;
    initialize(plugin: StatBlockPlugin) {
        this.registerIndex("source");
        this.registerSorter("name", (a, b) => a.name.localeCompare(b.name));

        this.#events = plugin.app.workspace;

        Watcher.initialize(plugin).load();

        plugin.addCommand({
            id: "parse-frontmatter",
            name: "Parse Frontmatter for Creatures",
            callback: () => {
                Watcher.start(true);
            }
        });
        plugin.register(() => Watcher.unload());

        plugin.registerEvent(
            plugin.app.workspace.on("fantasy-statblocks:srd-change", (srd) => {
                this.enableSRD = srd;
                if (srd) {
                    this.#library = new Map([
                        ...SRD_LIBRARY_BY_NAME,
                        ...this.#library
                    ]);
                } else {
                    this.#library = new Map([
                        ...this.#local,
                        ...this.#ephemeral
                    ]);
                }
            })
        );
        this.enableSRD = !plugin.settings.disableSRD;
        if (this.enableSRD) {
            this.#library = new Map(SRD_LIBRARY_BY_NAME);
        }
        for (const [, creature] of plugin.settings.participants) {
            this.addLocalCreature(creature);
        }
    }

    #addToIndex(creature: Participant) {
        setTimeout(() => {
            for (const [field, map] of this.#indices) {
                if (field in creature) {
                    let values = [];
                    if (Array.isArray(creature[field as keyof Participant])) {
                        for (const _v of creature[
                            field as keyof Participant
                        ] as Array<any>) {
                            values.push(stringify(_v));
                        }
                    } else {
                        values.push(
                            stringify(creature[field as keyof Participant])
                        );
                    }

                    for (const value of values) {
                        if (!map.has(value)) {
                            map.set(value, new Set([creature.name]));
                        } else {
                            map.get(value).add(creature.name);
                        }
                    }

                    this.#events.trigger(
                        `fantasy-statblocks:bestiary:indexed:${field}`
                    );
                }
            }
        }, 0);
    }
    #removeFromIndex(creature: Participant) {
        setTimeout(() => {
            for (const [field, map] of this.#indices) {
                if (field in creature) {
                    const value = stringify(creature[field as keyof Participant]);
                    if (map.has(value)) {
                        map.get(value).delete(creature.name);
                    }
                    this.#events.trigger(
                        `fantasy-statblocks:bestiary:indexed:${field}`
                    );
                }
            }
        }, 0);
    }

    hasLocal(name: string) {
        return this.#local.has(name);
    }
    getLocal(name: string) {
        return this.#local.get(name);
    }
    isLocal(name: string) {
        return (
            this.#local.has(name) &&
            this.#library.get(name) === this.#local.get(name)
        );
    }
    addLocalCreature(creature: Participant) {
        if (!creature.name) return;
        this.#local.set(creature.name, creature);
        this.#library.set(creature.name, creature);
        this.#addToIndex(creature);
        this.#triggerUpdatedCallbacks();
        this.#triggerSort();
    }
    removeLocalCreature(name: string) {
        if (
            this.#library.has(name) &&
            this.#library.get(name) === this.#local.get(name)
        ) {
            this.#library.delete(name);
        }
        this.#removeFromIndex(this.#local.get(name));
        this.#local.delete(name);
        if (this.#ephemeral.has(name)) {
            this.#library.set(name, this.#ephemeral.get(name));
        } else if (this.enableSRD && SRD_LIBRARY_BY_NAME.has(name)) {
            this.#library.set(name, SRD_LIBRARY_BY_NAME.get(name));
        }
        this.#triggerUpdatedCallbacks();
        this.#triggerSort();
    }
    addEphemeralCreature(creature: Participant) {
        if (!creature.name) return;
        this.#ephemeral.set(creature.name, creature);
        this.#library.set(creature.name, creature);
        this.#events.trigger(
            "fantasy-statblocks:bestiary:creature-added",
            creature
        );
        this.#addToIndex(creature);
        this.#triggerSort();
        this.#triggerUpdatedCallbacks();
    }
    removeEphemeralCreature(name: string) {
        this.#removeFromIndex(this.#library.get(name));
        this.#library.delete(name);
        this.#ephemeral.delete(name);
        this.#triggerUpdatedCallbacks();
        this.#triggerSort();
    }

    removeCreatures(...names: string[]) {
        for (const name of names) {
            if (this.isLocal(name)) {
                this.removeLocalCreature(name);
            } else {
                this.removeEphemeralCreature(name);
            }
        }
    }

    isResolved() {
        return this.#resolved;
    }
    setResolved(resolved: boolean) {
        this.#resolved = resolved;
        if (resolved) {
            this.#events.trigger("fantasy-statblocks:bestiary:resolved");

            this.#triggerUpdatedCallbacks();
            this.#triggerSort();
        }
    }

    onResolved(callback: () => void): () => void {
        let ref: EventRef;
        if (this.isResolved()) {
            callback();
        } else {
            ref = this.#events.on("fantasy-statblocks:bestiary:resolved", () =>
                callback()
            );
        }
        return () => {
            if (!ref) return;
            this.#events.offref(ref);
        };
    }
    onUpdated(callback: () => void): () => void {
        let ref: EventRef;
        if (this.isResolved()) {
            callback();
        } else {
            ref = this.#events.on("fantasy-statblocks:bestiary:updated", () =>
                callback()
            );
        }
        return () => {
            if (!ref) return;
            this.#events.offref(ref);
        };
    }

    #triggerUpdatedCallbacks() {
        if (this.isResolved()) {
            this.#events.trigger("fantasy-statblocks:bestiary:updated");
        }
    }
    size() {
        return this.#library.size;
    }

    /**
     * Get the fully defined plugin library.
     *
     * @returns {Map<string, Participant>}
     */
    getLibrary() {
        return this.#library;
    }

    /**
     * Get a list of library participants.
     *
     * @returns {Participant[]}
     */
    getLibraryParticipants(): Participant[] {
        return Array.from(this.#library.values());
    }

    /**
     * Get a list of library names.
     *
     * @returns {string[]}
     */
    getLibraryNames(): string[] {
        return Array.from(this.#library.keys()).sort();
    }

    /**
     * Returns true if the library contains the creature.
     *
     * @param {string} name
     * @returns {boolean}
     */
    hasCreature(name: string): boolean {
        return this.#library.has(name);
    }
    getExtensions(
        creature: Partial<Participant>,
        extended: Set<string>
    ): Partial<Participant>[] {
        let extensions: Partial<Participant>[] = [fastCopy(creature)];
        if (
            !("extends" in creature) ||
            !(
                Array.isArray(creature.extends) ||
                typeof creature.extends == "string"
            )
        ) {
            return extensions;
        }
        if (creature.extends && creature.extends.length) {
            for (const extension of [creature.extends].flat()) {
                if (extended.has(extension)) {
                    console.info(
                        "Circular extend dependency detected in " +
                            [...extended]
                    );
                    continue;
                }
                extended.add(creature.name);
                const extensionParticipant = this.#library.get(extension);
                if (!extensionParticipant) continue;
                extensions.push(
                    ...this.getExtensions(extensionParticipant, extended)
                );
            }
        }

        return extensions;
    }
    getExtensionNames(
        creature: Partial<Participant>,
        extended: Set<string>
    ): string[] {
        let extensions: string[] = [creature.name];
        if (
            !("extends" in creature) ||
            !(
                Array.isArray(creature.extends) ||
                typeof creature.extends == "string"
            )
        ) {
            return extensions;
        }
        if (creature.extends && creature.extends.length) {
            for (const extension of [creature.extends].flat()) {
                if (extended.has(extension)) {
                    console.info(
                        "Circular extend dependency detected in " +
                            [...extended]
                    );
                    continue;
                }
                extended.add(creature.name);
                const extensionParticipant = this.#library.get(extension);
                if (!extensionParticipant) continue;
                extensions.push(
                    ...this.getExtensionNames(extensionParticipant, extended)
                );
            }
        }

        return extensions;
    }

    /**
     * Retrieve a fully defined participant out of the library, resolving all extensions.
     *
     * @param {string} name Name of the creature to retrieve.
     * @returns {Partial<Participant> | null} The participant from the library, or null if not present.
     */
    async getCreatureFromBestiary(
        name: string
    ): Promise<Partial<Participant> | null> {
        return new Promise((resolve) => {
            this.onResolved(() => {
                if (!this.hasCreature(name)) resolve(null);
                let creature = this.#library.get(name);
                resolve(
                    Object.assign(
                        {},
                        ...this.getExtensions(creature, new Set(creature.name)),
                        creature
                    ) as Participant
                );
            });
        });
    }
    /**
     * Retrieve a fully defined participant out of the library, resolving all extensions.
     *
     * @param {string} name Name of the creautre to retrieve.
     * @returns {Partial<Participant> | null} The participant from the library, or null if not present.
     */
    getCreatureFromBestiarySync(name: string): Partial<Participant> | null {
        if (!this.isResolved())
            throw new Error("The library is not fully resolved.");
        if (!this.hasCreature(name)) return null;
        let creature = this.#library.get(name);
        return Object.assign(
            {},
            ...this.getExtensions(creature, new Set(creature.name)),
            creature
        ) as Participant;
    }

    //temp
    get(name: string) {
        return this.#library.get(name);
    }
}

export const Library = new LibraryClass();
