> 📖 Documentation and landing page: **[ttx-plugins.golodhrim.de](https://ttx-plugins.golodhrim.de)** *(coming soon)*
>
> <a href='https://www.buymeacoffee.com/golodhrim' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi3.png?v=3' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>

---

# TTX Character Cards

A statblock plugin for **[Obsidian](https://obsidian.md)** designed for **Tabletop Cybersecurity Exercises (TTX)**. Renders character cards for TTX participants and scenario cards for SGMs.

This plugin is a fork of [Fantasy Statblocks](https://github.com/javalent/fantasy-statblocks) by javalent, stripped of D&D content and adapted for TTX use.

## Included Layouts

### TTX Player Card
Renders a participant character card with fields:
`name`, `roles`, `speciality`, `modifier`, `bonus`, `delegation`, `strengths`, `special`, `crm_role`

### TTX Scenario
Renders a scenario card for SGM use with fields:
`name`, `attack_vector`, `difficulty`, `trigger`, `attacker_goal`, `phase1`, `phase2`, `phase3`, `crm_focus`, `hidden_complication`

## Usage

In any Obsidian note, create a statblock code block:

````yaml
```statblock
layout: TTX Player Card
name: "Georgi Stanchev"
roles: "Infrastructure · Azure"
modifier: "+4"
```
````

## Character Viewer

Open the Character Viewer pane (user icon in the ribbon) to search and preview participant cards without opening individual notes.

## Support

File issues on the **[GitLab repository](https://gitlab.com/golodhrim/ttx-character-cards/-/issues)**.
