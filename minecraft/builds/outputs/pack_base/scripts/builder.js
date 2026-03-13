import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

const MAX_FUNCTIONS = 1;
const FUNCTION_PREFIX = "load_structures_";

function runFunctionSeries(player, loc, startIndex = 1) {
    let current = startIndex;

    player.runCommand("tp @s ~~~ facing ~1 ~1 ~1");

    const runNext = () => {
        if (current > MAX_FUNCTIONS) {
            player.sendMessage("§aBuild Complete - fly around the unloaded areas to ensure it all appears");
            return;
        }

        player.runCommand(
            `execute positioned ${loc.x} ${loc.y} ${loc.z} run function ${FUNCTION_PREFIX}${current}`
        );

        player.sendMessage(`§aBuild Progress - ${current} chunks done of ${MAX_FUNCTIONS}`);

        current++;
        system.runTimeout(runNext, 100);
    };

    runNext();
}

function showConfirmForm(player) {
    const form = new ActionFormData()
        .title("Load Build")
        .body(
            "Do you want to load the build at your current location?\n\n" +
            "The build will begin loading directly in front of you, but sometimes you may have to fly forward some to begin seeing it place.\n\n" +
            "There isn’t an undo button so be careful and as always use a test world first."
        )
        .button("Yes")
        .button("No");

    form.show(player).then(response => {
        if (response.canceled) return;

        if (response.selection === 0) {
            const loc = { ...player.location };
            player.sendMessage("§aBuild Started");
            runFunctionSeries(player, loc);
        }
    });
}

world.beforeEvents.itemUse.subscribe((event) => {
    const player = event.source;
    if (!player?.isValid() || event.itemStack.typeId !== "original:name") return;

    system.run(() => {
        showConfirmForm(player);
    });
});
