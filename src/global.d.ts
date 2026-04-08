import { File } from "buffer"; // or wherever your File type comes from

declare global {
  // This extends the global namespace
  var thumbnailMap: Map<string, any>;
}

export {};
