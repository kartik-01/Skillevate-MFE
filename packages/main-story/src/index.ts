export type { StoryGap, StoryCourse, StoryNode, MainStoryMeta } from "./types";
export { coursesFromGaps, courseThumbnails, thumbnailForStoryCourse } from "./coursesFromGaps";
export { buildStoryNodes, buildMainStoryMeta, computeTaleId } from "./buildStory";
export type {
  BatchRecommendationRequest,
  BatchRecommendationResponse,
  BatchRecommendationItem,
  BatchSkillInput,
} from "./batchRecommendations";
export {
  buildBatchRecommendationRequestFromGaps,
  flattenBatchResponseToStoryCourses,
  storyCoursesFromBatchMock,
  fetchBatchRecommendationsStub,
} from "./batchRecommendations";
export type { TaleGamifySlice, TaleGamifyActivity } from "./gamifyPersist";
export {
  GAMIFY_PROGRESS_STORAGE_KEY,
  emptyTaleSlice,
  getTaleSlice,
  upsertTaleSlice,
} from "./gamifyPersist";
