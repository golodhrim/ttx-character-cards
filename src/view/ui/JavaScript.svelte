<script lang="ts">
    import type { Participant } from "index";
    import { Notice } from "obsidian";
    import type { JavaScriptItem } from "src/layouts/layout.types";
    import type StatBlockPlugin from "src/main";

    import { getContext } from "svelte";
    import type { Writable } from "svelte/store";

    export let block: JavaScriptItem;

    const participantStore = getContext<Writable<Participant>>("participant");
    let participant = $participantStore;
    participantStore.subscribe((m) => (participant = m));
    let plugin = getContext<StatBlockPlugin>("plugin");

    const render = (div: HTMLElement) => {
        if (block.code) {
            try {
                const func = new Function("participant", "property", block.code);
                const htmlElement = func.call(undefined, participant, plugin);
                if (htmlElement instanceof HTMLElement) {
                    div.appendChild(htmlElement);
                }
            } catch (e) {
                console.error(e);
            }
        }
    };
</script>

<div class="statblock-javascript" use:render />

<style>
</style>
