import { nanoid } from "src/util/util";
import type { DefaultLayout } from "../layout.types";

export const LayoutTTXScenario: DefaultLayout = {
    id: "ttx-scenario",
    name: "TTX Scenario",
    edited: false,
    blocks: [
        {
            type: "inline",
            id: nanoid(),
            properties: [],
            hasRule: true,
            nested: [
                {
                    type: "group",
                    id: nanoid(),
                    properties: ["name", "attack_vector", "difficulty"],
                    nested: [
                        {
                            type: "heading",
                            id: nanoid(),
                            properties: ["name"],
                            conditioned: true,
                            size: 1
                        },
                        {
                            type: "subheading",
                            id: nanoid(),
                            properties: ["attack_vector"],
                            conditioned: true
                        },
                        {
                            type: "subheading",
                            id: nanoid(),
                            properties: ["difficulty"],
                            conditioned: true
                        }
                    ]
                }
            ]
        },
        {
            type: "property",
            id: nanoid(),
            properties: ["trigger"],
            label: "Trigger (share with players)",
            conditioned: true,
            markdown: true,
            hasRule: false
        },
        {
            type: "property",
            id: nanoid(),
            properties: ["attacker_goal"],
            label: "Attacker Goal",
            conditioned: true,
            markdown: true,
            hasRule: true
        },
        {
            type: "property",
            id: nanoid(),
            properties: ["phase1"],
            label: "Phase 1 — Discovery",
            conditioned: true,
            markdown: true,
            hasRule: false
        },
        {
            type: "property",
            id: nanoid(),
            properties: ["phase2"],
            label: "Phase 2 — Containment",
            conditioned: true,
            markdown: true,
            hasRule: false
        },
        {
            type: "property",
            id: nanoid(),
            properties: ["phase3"],
            label: "Phase 3 — Recovery",
            conditioned: true,
            markdown: true,
            hasRule: true
        },
        {
            type: "property",
            id: nanoid(),
            properties: ["crm_focus"],
            label: "CRM Focus",
            conditioned: true,
            markdown: true,
            hasRule: false
        },
        {
            type: "property",
            id: nanoid(),
            properties: ["hidden_complication"],
            label: "Hidden Complication (SGM only)",
            conditioned: true,
            markdown: true,
            hasRule: false
        }
    ]
};
