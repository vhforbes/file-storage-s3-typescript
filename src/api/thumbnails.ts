import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import { env, file, type BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import path from "node:path";

type Thumbnail = {
  data: ArrayBuffer;
  mediaType: string;
};

export async function handlerGetThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Couldn't find video");
  }

  if (!video.thumbnailURL) {
    throw new NotFoundError("Thumbnail not found");
  }

  return new Response(video.thumbnailURL, {
    headers: {
      "Content-Type": "data:image/png;base64",
      "Cache-Control": "no-store",
    },
  });
}

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  const formData = await req.formData();
  const thumbnail = formData.get("thumbnail");

  if (thumbnail instanceof File) {
    if (thumbnail.type !== "image/jpeg" && thumbnail.type !== "image/png")
      throw new BadRequestError("Invalid File Typeeee");

    const MAX_UPLOAD_SIZE = 10 << 20;

    if (thumbnail.size > MAX_UPLOAD_SIZE)
      throw new BadRequestError("Thumb is too large");

    const mediaType = thumbnail.type;
    const arrayBuffer = await thumbnail.arrayBuffer();

    const thumbUrl = await saveToAssets(videoId, mediaType, arrayBuffer, cfg);

    const video = getVideo(cfg.db, videoId);

    if (video?.userID !== userID)
      throw new UserForbiddenError("Not video owner");

    video.thumbnailURL = thumbUrl;

    updateVideo(cfg.db, video);

    return respondWithJSON(200, video);
  } else {
    throw new BadRequestError("Invalid thumbnail");
  }
}

const saveToAssets = async (
  videoId: string,
  mediaType: string,
  arrayBuffer: ArrayBuffer,
  cfg: ApiConfig,
) => {
  const extension = mediaType.split("/")[1] || "bin";
  const fileName = `${videoId}.${extension}`;

  const absoluteAssetsDir = path.resolve(process.cwd(), cfg.assetsRoot);
  const destinationPath = path.join(absoluteAssetsDir, fileName);

  await Bun.write(destinationPath, arrayBuffer);

  const domain = `http://localhost:${cfg.port}`;
  const fullUrl = `${domain}/assets/${fileName}`;

  return fullUrl;
};
