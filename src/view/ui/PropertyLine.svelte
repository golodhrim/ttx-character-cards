<script lang="ts">
    import type { Participant } from "../../../index";
    import { Notice } from "obsidian";
    import type { PropertyItem } from "../../layouts/layout.types";
    import { slugify, stringify } from "../../util/util";
    import TextContentHolder from "./TextContentHolder.svelte";

    export let participant: Participant;
    export let item: PropertyItem;

    let property = stringify(participant[item.properties[0]], 0, ", ", false);
    let display = item.display ?? item.properties[0];

    if (item.callback) {
        try {
            const frame = document.body.createEl("iframe");
            const funct = (frame.contentWindow as any).Function;
            const func = new funct("participant", item.callback);
            property = func.call(undefined, participant) ?? property;
            document.body.removeChild(frame);
        } catch (e) {
            new Notice(
                `There was an error executing the provided callback for [${item.properties.join(
                    ", "
                )}]\n\n${e.message}`
            );
            console.error(e);
        }
    }
    if (!item.conditioned && !`${property}`.length) {
        property = item.fallback ?? "-";
    }

    $: cssClass = item.doNotAddClass ? "" : slugify(item.properties[0]);
</script>

{#if !item.conditioned || (item.conditioned && `${property}`.length)}
    <div class="line {cssClass}">
        <span class="property-name">{display}</span>
        <TextContentHolder {property} />
    </div>
{/if}

<style>
    .line {
        line-height: var(--active-property-line-height);
        display: block;
        font-family: var(--active-property-font);
        color: var(--active-property-font-color);
        font-variant: var(--active-property-font-variant);
        font-size: var(--active-property-font-size);
        font-weight: var(--active-property-font-weight);
    }
    .property-name {
        margin: 0;
        margin-right: 0.25em;
        display: inline;
        font-family: var(--active-property-name-font);
        color: var(--active-property-name-font-color);
        font-variant: var(--active-property-name-font-variant);
        font-size: var(--active-property-name-font-size);
        font-weight: var(--active-property-name-font-weight);
    }
</style>
