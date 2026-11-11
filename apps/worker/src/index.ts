import artworkIds from './generated/artwork-ids.json';
import { createWorker } from './app.ts';

export default createWorker(artworkIds);
