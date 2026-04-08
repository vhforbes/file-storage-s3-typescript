import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import { env, type BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";

type Thumbnail = {
  data: ArrayBuffer;
  mediaType: string;
};

const videoThumbnails: Map<string, Thumbnail> = new Map();

export async function handlerGetThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Couldn't find video");
  }

  const thumbnail = videoThumbnails.get(videoId);
  if (!thumbnail) {
    throw new NotFoundError("Thumbnail not found");
  }

  return new Response(thumbnail.data, {
    headers: {
      "Content-Type": thumbnail.mediaType,
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

  console.log("uploading thumbnail for video", videoId, "by user", userID);

  // TODO: implement the upload here

  const formData = await req.formData();
  const thumbnail = formData.get("thumbnail");

  if (thumbnail instanceof File) {
    const MAX_UPLOAD_SIZE = 10 << 20;

    if (thumbnail.size > MAX_UPLOAD_SIZE)
      throw new BadRequestError("Thumb is too large");

    const mediaType = thumbnail.type;
    const arrayBuffer = await thumbnail.arrayBuffer();

    const video = getVideo(cfg.db, videoId);

    if (video?.userID !== userID)
      throw new UserForbiddenError("Not video owner");

    videoThumbnails.set(videoId, {
      mediaType: mediaType,
      data: arrayBuffer,
    });

    const thumbUrl = `http://localhost:${cfg.port}/api/thumbnails/${videoId}`;

    video.thumbnailURL = thumbUrl;

    updateVideo(cfg.db, video);

    return respondWithJSON(200, video);
  } else {
    throw new BadRequestError("Invalid thumbnail");
  }
}
