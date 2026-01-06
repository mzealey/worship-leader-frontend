import { eventSocket } from './event-socket';

const song_stat = eventSocket.add_queue('song', 500);
export function song_feedback(type: string, song_id: number): void {
    song_stat([type, song_id]);
}

const file_stat = eventSocket.add_queue('file', 500);
export function file_feedback(type: string, song_id: number, file_id: number | string): void {
    file_stat([type, song_id, file_id]);
}
