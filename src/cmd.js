const program = require('commander');
const fs = require("fs");
const createError = require("better-custom-error/dist").default;

const ArgumentError = createError("ArgumentError");

const packageJson = require("../package.json");

const number = (value) => {
    return parseInt(value, 10);
};

const kbps = (value) => {
    return value + "k";
};

const rotateMap = {
    90: "transpose=1",
    180: ["transpose=2", "transpose=2"],
    270: "transpose=2",
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
        fs.accessSync(value);
        return value;
    }
    catch (e) {
        throw new ArgumentError(`File ${value} doesn't exist or is inaccessible.`);
    }
};

module.exports = () => {
    try {
        program.version(packageJson.version, '-v, --version')
            .arguments("<file>")
            .option("-i, --input <path>", "source file to encode", filePath)
            .option("--a:channels <number>", "sets audio channels count", number, 1)
            .option(
                "--v:quality <number>",
                "sets video quality (0-51, where 0 is lossless, 17 is visually lossless, 23 is optimal default)",
                number,
                23,
            )
            .option(
                "--v:rotate <degrees>",
                "rotates video, only `90`, `180`, `270` are valid values",
                rotate,
            )
            .option(
                "--a:bitrate <number>",
                "sets audio quality (in kbps)",
                kbps,
                "128k",
            )
            .option(
                "--v:preset <preset>",
                "sets video encoding preset", // @todo list presets as validation
                "slow",
            )
            .parse(process.argv)
        ;
    }
    catch (e) {
        if (e instanceof ArgumentError) {
            console.error(e.message);
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

    return program;
};