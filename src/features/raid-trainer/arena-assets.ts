import type { EncounterDefinition } from "./model";

const decodedImages = new Map<string, HTMLImageElement>();
const pendingImages = new Map<string, Promise<HTMLImageElement>>();
const ASSET_TIMEOUT_MS = 10_000;

function imagePaths(encounter: EncounterDefinition) {
  return [
    encounter.artwork,
    encounter.boss.portrait,
    ...Object.values(encounter.abilities).flatMap((ability) => [
      ability.icon,
      ability.regroupIcon,
    ]),
    ...encounter.actors.map((actor) => actor.classIcon),
  ].filter((path): path is string => Boolean(path));
}

function timeoutError(path: string) {
  return new Error(`Timed out loading arena asset: ${path}`);
}

function waitForLoad(image: HTMLImageElement, path: string, deadline: number) {
  if (image.complete) {
    return image.naturalWidth > 0
      ? Promise.resolve()
      : Promise.reject(new Error(`Unable to load arena asset: ${path}`));
  }

  return new Promise<void>((resolve, reject) => {
    const remaining = deadline - Date.now();
    const loaded = () => {
      cleanup();
      resolve();
    };
    const failed = () => {
      cleanup();
      reject(new Error(`Unable to load arena asset: ${path}`));
    };
    const cleanup = () => {
      clearTimeout(timeout);
      image.removeEventListener("load", loaded);
      image.removeEventListener("error", failed);
    };
    const timeout = setTimeout(
      () => {
        cleanup();
        reject(timeoutError(path));
      },
      Math.max(0, remaining),
    );
    image.addEventListener("load", loaded, { once: true });
    image.addEventListener("error", failed, { once: true });
  });
}

function waitForDecode(
  image: HTMLImageElement,
  path: string,
  deadline: number,
) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(timeoutError(path)),
      Math.max(0, deadline - Date.now()),
    );
    void image.decode().then(
      () => {
        clearTimeout(timeout);
        resolve();
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function loadImage(path: string) {
  const decoded = decodedImages.get(path);
  if (decoded) return Promise.resolve(decoded);

  const pending = pendingImages.get(path);
  if (pending) return pending;

  const operation = (async () => {
    const deadline = Date.now() + ASSET_TIMEOUT_MS;
    const image = new Image();
    image.decoding = "async";
    image.src = path;
    await waitForLoad(image, path, deadline);
    await waitForDecode(image, path, deadline);
    if (!image.naturalWidth)
      throw new Error(`Unable to decode arena asset: ${path}`);
    decodedImages.set(path, image);
    return image;
  })();

  pendingImages.set(path, operation);
  void operation.finally(() => pendingImages.delete(path)).catch(() => {});
  return operation;
}

export function getArenaAsset(path?: string) {
  return path ? (decodedImages.get(path) ?? null) : null;
}

export async function prepareArenaAssets(encounter: EncounterDefinition) {
  await Promise.all([...new Set(imagePaths(encounter))].map(loadImage));
}
