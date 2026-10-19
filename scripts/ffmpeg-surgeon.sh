#!/bin/bash
set -euo pipefail

# ffmpeg-surgeon implementation
# Strips metadata and injects the Aphrodite watermark onto preview files

if [ "$#" -lt 3 ]; then
    echo "Usage: $0 <input_video_path> <watermark_image_path> <output_directory> [watermark_position] [watermark_scale]"
    exit 1
fi

INPUT_VIDEO=$1
WATERMARK_IMG=$2
OUTPUT_DIR=$3
POSITION=${4:-"bottom-right"}
SCALE=${5:-"0.2"}

command -v ffmpeg >/dev/null 2>&1 || { echo "Error: ffmpeg is not installed"; exit 1; }

# Scale is interpolated into the filter graph, so it must be a plain positive number
if ! [[ "$SCALE" =~ ^[0-9]*\.?[0-9]+$ ]]; then
    echo "Error: watermark_scale must be a positive number, got '$SCALE'"
    exit 1
fi

# Validate input
if [ ! -f "$INPUT_VIDEO" ]; then
    echo "Error: Input video not found at $INPUT_VIDEO"
    exit 1
fi

if [ ! -f "$WATERMARK_IMG" ]; then
    echo "Error: Watermark image not found at $WATERMARK_IMG"
    exit 1
fi

mkdir -p "$OUTPUT_DIR"

FILENAME=$(basename -- "$INPUT_VIDEO")
BASENAME="${FILENAME%.*}"
OUTPUT_FILE="$OUTPUT_DIR/${BASENAME}_watermarked.mp4"

# Determine position coordinates
case "$POSITION" in
    bottom-right) COORD="x=W-w-10:y=H-h-10" ;;
    bottom-left)  COORD="x=10:y=H-h-10" ;;
    top-right)    COORD="x=W-w-10:y=10" ;;
    top-left)     COORD="x=10:y=10" ;;
    center)       COORD="x=(W-w)/2:y=(H-h)/2" ;;
    *)
        echo "Error: unknown position '$POSITION' (bottom-right|bottom-left|top-right|top-left|center)"
        exit 1
        ;;
esac

echo "Processing $INPUT_VIDEO..."
echo "Stripping metadata and applying watermark at scale $SCALE at $POSITION"

ffmpeg -i "$INPUT_VIDEO" \
       -i "$WATERMARK_IMG" \
       -map_metadata -1 -map_chapters -1 \
       -filter_complex "[1:v]scale=iw*$SCALE:-1[wm];[0:v][wm]overlay=$COORD" \
       -c:v libx264 -preset fast -crf 28 -pix_fmt yuv420p -movflags +faststart \
       -c:a aac -b:a 128k \
       -hide_banner -y \
       "$OUTPUT_FILE"

echo "Successfully created $OUTPUT_FILE"
