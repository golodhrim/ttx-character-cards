<script lang="ts">
    import type { Participant } from "types";
    import type { TextItem } from "src/layouts/layout.types";
    import { stringify } from "src/util/util";

    import SectionHeading from "./SectionHeading.svelte";
    import TextContentHolder from "./TextContentHolder.svelte";

    export let participant: Participant;
    export let item: TextItem;

    let property =
        item.text && item.text.length
            ? item.text
            : stringify(participant[item.properties[0]]);

    if (!item.conditioned && !`${property}`.length) {
        property = item.fallback ?? "-";
    }
</script>

{#if !item.conditioned || (item.conditioned && `${property}`.length)}
    {#if item.heading}
        <SectionHeading {item} {participant} />
    {/if}
    <div class="line">
        <TextContentHolder render={item.markdown} {property} />
    </div>
{/if}

<style></style>
