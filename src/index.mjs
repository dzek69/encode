#!/usr/bin/env node

import path from "path";
import { spawn, execFile } from "child_process";
import fs from "fs-extra";
import pretty from "pretty-bytes";
import colors from "colors/safe.js";

import cmd from "./cmd.mjs";

const program = cmd();
const inputFileName = path.basename(program.input);
const inputFileNameParts = inputFileName.split(".");
inputFileNameParts.pop();
const inputFileNameWithoutExt = inputFileNameParts.join(".");
const outputFileName = inputFileNameWithoutExt + ".encoded.mp4";

const makeArray = (value) => {
    return Array.isArray(value) ? value : [value];
};

const buildOptionalParams = () => { // eslint-disable-line max-statements
    const vf = [];
    if (program["v:rotate"]) {
        const rotate = makeArray(program["v:rotate"]);
        vf.push(...rotate);
    }

    if (program["v:scale"]) {
        vf.push("scale=" + program["v:scale"]);
    }

    const optionalParams = [];
    if (vf.length) {
        optionalParams.push("-vf", vf.join(","));
    }

    if (program["v:fps"]) {
        optionalParams.push("-r", program["v:fps"]);
    }

    if (program["a:channels"]) {
        optionalParams.push("-ac", program["a:channels"]);
    }

    if (program["a:copy"]) {
        optionalParams.push("-c:a", "copy");
    }
    else if (program["a:none"]) {
        optionalParams.push("-an");
    }
    else {
        optionalParams.push("-c:a", "aac");
    }

    if (program.from) {
        optionalParams.push("-ss", program.from);
    }

    if (program.to) {
        optionalParams.push("-to", program.to);
    }

    return optionalParams;
};

const encode = () => {
    const optionalParams = buildOptionalParams();
    const meta = program.meta
        ? [
            "-map_metadata", "0",
            "-movflags", "use_metadata_tags",
        ]
        : [];

    const overwrite = program.overwrite ? ["-y"] : [];

    return new Promise((resolve, reject) => {
        const ff = spawn("ffmpeg", [
            "-n",
            "-i", program.input,
            "-c:v", "libx264",
            "-preset", program["v:preset"],
            "-crf", program["v:quality"],
            ...optionalParams,
            "-vsync", "2",
            "-tune", program["v:tune"],
            "-movflags", "+faststart",
            ...meta,
            ...overwrite,
            outputFileName,
        ]);
        console.info(colors.green(ff.spawnargs.join(" ")));
        let lastError = "";
        ff.stdout.on("data", data => console.info(String(data)));
        ff.stderr.on("data", data => {
            lastError = String(data);
            console.error(lastError);
        });
        ff.on("close", (code) => {
            console.info("Process exited with code:", code);
            if (!code) {
                resolve();
                return;
            }
            if (lastError.includes("already exists. Exiting")) {
                resolve();
                return;
            }
            reject(new Error("ffmpeg exited with code: " + code));
        });
    });
};

const getModifiedDate = () => {
    return new Promise((resolve, reject) => {
        execFile("date", ["-R", "-r", program.input], (error, stdout, stderr) => {
            if (error) {
                reject(new Error(error)); // @todo can do better error?
                return;
            }
            resolve(stdout);
        });
    });
};

const setModifiedDate = (file, newDate) => {
    return new Promise((resolve, reject) => {
        execFile("touch", ["-d", newDate, file], (error, stdout, stderr) => {
            if (error) {
                reject(new Error(error)); // @todo can do better error?
                return;
            }
            resolve(stdout);
        });
    });
};

const fixDate = async () => {
    const date = await getModifiedDate(program.input);
    await setModifiedDate(outputFileName, date);
};

const sizeDiff = async () => {
    const oldFile = await fs.stat(program.input);
    const newFile = await fs.stat(outputFileName);
    const diff = oldFile.size - newFile.size;
    console.info("");
    console.info(`Old file size: ${pretty(oldFile.size)}`);
    console.info(`New file size: ${pretty(newFile.size)}`);
    if (diff > 0) {
        console.info("You have saved", pretty(diff));
    }
    else if (diff < 0) {
        console.info("New file is larger by", pretty(-diff));
    }
    else {
        console.info("File sizes are exactly the same! Amazing!");
    }
};

(async () => {
    try {
        await encode();
        await fixDate();
        await sizeDiff();
        console.info("");
        console.info("Success!");
    }
    catch (e) {
        console.error("");
        console.error("Error happened");
        console.error(e);
    }
})();
