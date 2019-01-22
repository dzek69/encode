const path = require("path");
const { spawn, execFile } = require("child_process");
const fs = require("fs-extra");
const pretty = require("pretty-bytes");

const cmd = require("./cmd");

const program = cmd();
const inputFileName = path.basename(program.input);
const inputFileNameParts = inputFileName.split(".");
// const inputFileExt = inputFileNameParts.pop();
inputFileNameParts.pop();
const inputFileNameWithoutExt = inputFileNameParts.join(".");
const outputFileName = inputFileNameWithoutExt + ".encoded.mp4";

const makeArray = (value) => {
    return Array.isArray(value) ? value : [value];
};

const encode = () => {
    const vf = [];
    if (program["v:rotate"]) {
        const rotate = makeArray(program["v:rotate"]);
        vf.push(...rotate);
    }

    const vfParam = [];
    if (vf.length) {
        vfParam.push("-vf", vf.join(","));
    }

    return new Promise((resolve, reject) => {
        const ff = spawn("ffmpeg", [
            "-n",
            "-i", program.input,
            "-c:v", "libx264",
            "-preset", program["v:preset"],
            "-crf", program["v:quality"],
            ...vfParam,
            "-ac", program["a:channels"],
            "-c:a", "aac",
            "-b:a", program["a:bitrate"],
            "-tune", "zerolatency",
            "-movflags", "+faststart",
            outputFileName,
        ]);
        let lastError = "";
        ff.stdout.on("data", data => console.log(String(data)));
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
        })
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
        })
    });
};

const fixDate = async () => {
    const date = await getModifiedDate(program.input);
    await setModifiedDate(outputFileName, date);
};

const sizeDiff = async () => {
    const oldFile = await fs.stat(program.input);
    const newFile = await fs.stat(outputFileName);
    const sizeDiff = oldFile.size - newFile.size;
    console.info("");
    console.info(`Old file size: ${pretty(oldFile.size)}`);
    console.info(`New file size: ${pretty(newFile.size)}`);
    if (sizeDiff > 0) {
        console.info("You have saved", pretty(sizeDiff));
    }
    else if (sizeDiff < 0) {
        console.info("New file is larger by", pretty(-sizeDiff));
    }
    else {
        console.info("File sizes are exactly the same! Amazing!");
    }
};

(async () => {
    try {
        await encode();
        await fixDate();
        await sizeDiff()
        console.info("");;
        console.info("Success!");
    }
    catch (e) {
        console.info("");
        console.error("Error happend");
        console.error(e);
    }
})();
