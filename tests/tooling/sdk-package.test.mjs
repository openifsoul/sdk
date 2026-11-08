import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, copyFile, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
test("SDK archive installs and exposes runtime/types outside Core without registry or sibling source", async () => {
  execFileSync("pnpm", ["build"], { cwd: root, stdio: "pipe" });
  execFileSync("pnpm", ["pack", "--pack-destination", ".local/packages"], {
    cwd: root,
    stdio: "pipe",
  });
  const directory = await mkdtemp(path.join(tmpdir(), "ifsoul-sdk-consumer-"));
  try {
    await mkdir(path.join(directory, "vendor"));
    await copyFile(
      path.join(root, ".local/packages/ifsoul-adapter-sdk-0.3.0.tgz"),
      path.join(directory, "vendor/sdk.tgz"),
    );
    await writeFile(
      path.join(directory, "package.json"),
      JSON.stringify({
        private: true,
        type: "module",
        dependencies: { "@ifsoul/adapter-sdk": "file:vendor/sdk.tgz" },
      }),
    );
    execFileSync("pnpm", ["install", "--offline", "--ignore-scripts"], {
      cwd: directory,
      stdio: "pipe",
    });
    const consumer = `import {createGameBridge,scenarioResponse,BRIDGE_VERSION} from '@ifsoul/adapter-sdk';\nimport type {GameMountOptions,MountedGame,BridgeTransport} from '@ifsoul/adapter-sdk';\nconst transport:BridgeTransport=async request=>scenarioResponse(request);\nconst lifetime=new AbortController();\nconst bridge=createGameBridge({hostId:'external',character:{id:'original',name:'Original',temperament:'curious'},transport,history:()=>[],onObservation:()=>{},onSpeech:()=>{},signal:lifetime.signal});\nconst reply=await bridge.decide({requestId:'move',context:'Choose the only legal move.',choices:[{id:'wait',label:'Wait'}],fallbackChoiceId:'wait'});\nif(reply.choiceId!=='wait'||reply.source!=='scenario'||BRIDGE_VERSION!=='ifsoul-bridge/0.3.0')throw Error('Invalid external bridge result');\nbridge.dispose();\nexport type Contract=[GameMountOptions,MountedGame];`;
    await writeFile(path.join(directory, "consumer.ts"), consumer);
    await writeFile(
      path.join(directory, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          lib: ["ES2022", "DOM"],
          types: [],
          outDir: "out",
        },
        include: ["consumer.ts"],
      }),
    );
    execFileSync(
      process.execPath,
      [
        path.join(root, "node_modules/typescript/bin/tsc"),
        "--project",
        path.join(directory, "tsconfig.json"),
      ],
      { cwd: directory, stdio: "pipe" },
    );
    execFileSync(process.execPath, ["out/consumer.js"], {
      cwd: directory,
      stdio: "pipe",
    });
    await writeFile(
      path.join(directory, "service.ts"),
      `import {createGameBridge,scenarioResponse} from '@ifsoul/adapter-sdk/bridge';
import type {BridgeTransport} from '@ifsoul/adapter-sdk/bridge';
const transport:BridgeTransport=async request=>scenarioResponse(request);
const bridge=createGameBridge({hostId:'observatory-service',character:{id:'archivist',name:'Neri',temperament:'patient archivist'},transport,history:()=>[],onObservation:()=>{},onSpeech:()=>{},signal:new AbortController().signal});
const reply=await bridge.decide({requestId:'schedule',context:'Select a permitted appointment.',choices:[{id:'wait',label:'Wait'}],fallbackChoiceId:'wait'});
if(reply.choiceId!=='wait')throw Error('Unknown host choice');
bridge.dispose();`,
    );
    await writeFile(
      path.join(directory, "tsconfig.service.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          lib: ["ES2022"],
          types: ["node"],
          typeRoots: [path.join(root, "node_modules/@types")],
          outDir: "service-out",
        },
        include: ["service.ts"],
      }),
    );
    execFileSync(
      process.execPath,
      [
        path.join(root, "node_modules/typescript/bin/tsc"),
        "--project",
        path.join(directory, "tsconfig.service.json"),
      ],
      { cwd: directory, stdio: "pipe" },
    );
    execFileSync(process.execPath, ["service-out/service.js"], {
      cwd: directory,
      stdio: "pipe",
    });
    const frozen = execFileSync(
      "pnpm",
      ["install", "--offline", "--frozen-lockfile", "--ignore-scripts"],
      { cwd: directory, encoding: "utf8" },
    );
    assert.match(frozen, /up to date|Already up to date|Lockfile/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
