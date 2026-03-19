import type { API } from "src/api/api";
import type { DefaultLayout, Layout } from "src/layouts/layout.types";

export interface Participant {
    /** Required */
    name: string;

    /** TTX Player Card fields */
    roles?: string;
    speciality?: string;
    modifier?: string;
    bonus?: string;
    delegation?: string;
    strengths?: string;
    special?: string;
    crm_role?: string;

    /** TTX Scenario fields */
    attack_vector?: string;
    difficulty?: string;
    trigger?: string;
    attacker_goal?: string;
    phase1?: string;
    phase2?: string;
    phase3?: string;
    crm_focus?: string;
    hidden_complication?: string;

    /** Plugin internals */
    image?: string;
    source?: string | string[];
    layout?: string;
    note?: string;
    path?: string;
    mtime?: number;
    library?: boolean;
    extends?: string | string[];
    export?: boolean;
    columns?: number;
    columnWidth?: number;
    columnHeight?: number;
    forceColumns?: boolean;

    [key: string]: any;
}

export interface StatblockParameters
    extends Omit<
        Participant,
        | "traits"
        | "actions"
        | "bonus_actions"
        | "legendary_actions"
        | "reactions"
    > {
    traits?: { desc: string; name: string }[];
    actions?: Trait[];
    bonus_actions?: Trait[];
    legendary_actions?: Trait[];
    reactions?: Trait[];
}

export type Spell = string | { [key: string]: string };

export interface Trait {
    name: string;
    desc: string;
    traits?: Trait[];
    [key: string]: any;
}

export interface StatblockData {
    participants: Array<[string, Participant]>;
    defaultLayouts: Record<string, DefaultLayout>;
    layouts: Layout[];
    default: string;
    useDice: boolean;
    renderDice: boolean;
    export: boolean;
    showAdvanced: boolean;
    version: {
        major: number;
        minor: number;
        patch: number;
    };
    paths: string[];
    autoParse: boolean;
    disableSRD: boolean;
    tryToRenderLinks: boolean;
    debug: boolean;
    notifiedOfFantasy: boolean;
    hideConditionHelp: boolean;
    alwaysImport: boolean;
    defaultLayoutsIntegrated: boolean;
    atomicWrite: boolean;
}

declare global {
    interface Window {
        FantasyStatblocks: API;
    }
}
