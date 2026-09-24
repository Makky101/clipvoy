##TASKS FOR CLIPVOY
#Update worker.ts to upload finished process videos back bucket
-fix type promise<string> when using ffmpeg
- we need to download the video from s3 and stream it ffmpeg (I will not use multer)
- send those videos back using the same s3
----------------------------------------------------------------------------------
- add presigned temporary url for frontend browser to upload videos  to the bucket
- Delete Multer
- add web sockets rather than polling for updating client on backend's progress

##Front end design
- make UI look cleaner especially for the web sockets aspect
- put a modal that hovers for when clips are done generating 
- remove all big unimportant text