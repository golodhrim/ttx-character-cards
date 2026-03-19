import type { Participant } from "../../index";
import { renderMatches, type FuzzyMatch } from "obsidian";
import { FuzzyInputSuggest } from "@javalent/utilities";
import { stringify } from "./util";

export class ParticipantSuggestionModal extends FuzzyInputSuggest<Participant> {
    field: keyof Participant = "name";
    getItemText(item: Participant): string {
        return stringify(item[this.field]);
    }
    renderNote(noteEL: HTMLElement, result: FuzzyMatch<Participant>): void {
        const { item, match } = result;
        renderMatches(noteEL, stringify(item.source), match.matches);
    }
    renderTitle(titleEl: HTMLElement, result: FuzzyMatch<Participant>): void {
        const { item, match } = result;
        renderMatches(titleEl, stringify(item.name), match.matches);
    }
}
