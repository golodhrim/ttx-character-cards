import { nanoid } from "src/util/util";
import type { DefaultLayout } from "../layout.types";

export const LayoutTTXPlayerCard: DefaultLayout = {
    id: "ttx-player-card",
    name: "TTX Player Card",
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
                    properties: ["name", "roles"],
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
                            properties: ["roles"],
                            conditioned: true,
                            separator: " · "
                        }
                    ]
                }
            ]
        },
        {
            type: "property",
            id: nanoid(),
            properties: ["speciality"],
            label: "Speciality",
            conditioned: true,
            markdown: true,
            hasRule: false
        },
        {
            type: "property",
            id: nanoid(),
            properties: ["modifier"],
            label: "Roll Modifier",
            conditioned: true,
            hasRule: false
        },
        {
            type: "property",
            id: nanoid(),
            properties: ["bonus"],
            label: "Bonus",
            conditioned: true,
            markdown: true,
            hasRule: false
        },
        {
            type: "property",
            id: nanoid(),
            properties: ["delegation"],
            label: "Delegation",
            conditioned: true,
            hasRule: false
        },
        {
            type: "property",
            id: nanoid(),
            properties: ["strengths"],
            label: "Strengths",
            conditioned: true,
            markdown: true,
            hasRule: false
        },
        {
            type: "property",
            id: nanoid(),
            properties: ["special"],
            label: "Special",
            conditioned: true,
            markdown: true,
            hasRule: true
        },
        {
            type: "property",
            id: nanoid(),
            properties: ["crm_role"],
            label: "CRM Role (SGM)",
            conditioned: true,
            markdown: true,
            hasRule: false
        }
    ]
};
