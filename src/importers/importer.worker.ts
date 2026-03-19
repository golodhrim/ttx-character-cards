import type { Participant } from "index";

const ctx: Worker = self as any;

ctx.onmessage = async (event) => {
    if (!event.data) return;

    const { files, source } = event.data;
    const participants: Participant[] = [];
    for (const file of files) {
        switch (source) {
            case "generic": {
                const imported: Participant[] = await new Promise(
                    (resolve, reject) => {
                        const reader = new FileReader();

                        reader.onload = async (event: any) => {
                            try {
                                let json = JSON.parse(event.target.result);
                                let items: any[] = [];
                                if (Array.isArray(json)) {
                                    items = json;
                                } else if (typeof json == "object") {
                                    if (!("name" in json)) {
                                        for (const key in json) {
                                            if (Array.isArray(json[key])) {
                                                items.push(...json[key]);
                                            }
                                        }
                                    } else {
                                        items = [json];
                                    }
                                } else {
                                    reject(
                                        "Invalid participant JSON provided. Must be array or object."
                                    );
                                }
                                const imported: Participant[] = [];
                                for (const item of items) {
                                    if ("name" in item) {
                                        imported.push(item);
                                    }
                                }
                                resolve(imported);
                            } catch (e) {
                                console.error(`reject!!!`, e);
                                reject(e);
                            }
                        };

                        reader.readAsText(file);
                    }
                );
                participants.push(...(imported ?? []));
                break;
            }
            default: {
                console.error(`Unknown source: ${source}`);
            }
        }
    }

    ctx.postMessage({ participants });
};

ctx.addEventListener(
    "unhandledrejection",
    function (event: PromiseRejectionEvent) {
        throw event.reason;
    }
);
