/* eslint-disable no-process-exit */

import program from "commander";
import fs from "fs";
import createError from "better-custom-error";
import { join } from "path";

import __dirname from "./dirname.mjs";

const DEFAULT_QUALITY = 25;
const DEFAULT_PRESET = "slow";
const DEFAULT_TUNE = "film";

const ArgumentError = createError("ArgumentError");

// @TODO deal with that ⬇
// eslint-disable-next-line no-sync
const packageJson = JSON.parse(String(fs.readFileSync(join(__dirname, "..", "package.json"))));

const number = (value) => {
    return parseInt(value, 10);
};

const float = (value) => {
    return parseFloat(value);
};

const kbps = (value) => {
    return value + "k";
};

const rotateMap = {
    "90": "transpose=1",
    "180": ["transpose=2", "transpose=2"],
    "270": "transpose=2",
    "-90": "transpose=2",
};

const rotate = (value) => {
    const vf = rotateMap[value];
    if (!vf) {
        throw new ArgumentError(`Rotation ${value} is incorrect`);
    }
    return vf;
};

const filePath = (value) => {
    try {
        fs.accessSync(value); // eslint-disable-line no-sync
        return value;
    }
    catch (e) { // eslint-disable-line no-unused-vars
        throw new ArgumentError(`File ${value} doesn't exist or is inaccessible.`);
    }
};

const cmd = () => { // eslint-disable-line max-statements, max-lines-per-function
    try {
        program.version(packageJson.version, "-v, --version")
            .option("-i, --input <path>", "source file to encode", filePath)
            .option(
                "--v:quality <number>",
                "sets video quality (0-51, where 0 is lossless, 17 is visually lossless, 23 is optimal default)",
                number,
                DEFAULT_QUALITY,
            )
            .option(
                "--v:fps <number>",
                "sets output video framerate",
                float,
            )
            .option(
                "--v:rotate <degrees>",
                "rotates video, only `90`, `180`, `270` are valid values",
                rotate,
            )
            .option(
                "--v:scale <degrees>",
                "scales video, feed it with raw ffmpeg `scale` `vf`, basic example: 1280x720, 1280:-1, -1:720",
            )
            .option(
                "--v:preset <preset>",
                "sets video encoding preset", // @todo list presets as validation
                DEFAULT_PRESET,
            )
            .option(
                "--v:tune <tune>",
                "sets video tune preset", // @todo list presets as validation
                DEFAULT_TUNE,
            )
            .option("--a:copy", "copies source audio")
            .option("--a:none", "disables audio")
            .option("--a:channels <number>", "sets audio channels count", number)
            .option(
                "--a:bitrate <number>",
                "sets audio quality (in kbps)",
                kbps,
            )
            .option(
                "--from <string>",
                "cuts video from this time",
            )
            .option(
                "--to <string>",
                "cuts video to this time",
            )
            .option("--no-meta", "skips metadata copying")
            .option("-y, --overwrite", "overwrites encoded file if already exists")
            .parse(process.argv);
    }
    catch (e) {
        if (e instanceof ArgumentError) {
            console.error("error:", e.message);
            process.exit(1);
        }

        console.error("Unexpected error");
        console.error(e);
        process.exit(1);
    }

    if (!program.input) {
        console.error("error: required option `-i, --input <path>` missing");
        process.exit(1);
    }

    if (program["a:copy"]) {
        if (program["a:bitrate"] || program["a:channels"]) {
            console.error("error: you can't configure audio settings if you set to copy it");
            process.exit(1);
        }
        if (program["a:none"]) {
            console.error("error: you can't disable audio if you set to copy it");
            process.exit(1);
        }
    }

    if (program["a:none"]) {
        if (program["a:bitrate"] || program["a:channels"]) {
            console.error("error: you can't configure audio settings if you disabled");
            process.exit(1);
        }
    }

    return program;
};

export default cmd;
