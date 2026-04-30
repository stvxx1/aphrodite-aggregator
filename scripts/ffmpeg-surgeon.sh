#!/bin/bash

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
if [ "$POSITION" == "bottom-right" ]; then
    COORD="x=W-w-10:y=H-h-10"
elif [ "$POSITION" == "top-left" ]; then
    COORD="x=10:y=10"
elif [ "$POSITION" == "center" ]; then
    COORD="x=(W-w)/2:y=(H-h)/2"
else
    COORD="x=W-w-10:y=H-h-10" # Default bottom right
fi

echo "Processing $INPUT_VIDEO..."
echo "Stripping metadata and applying watermark at scale $SCALE at $POSITION"

ffmpeg -i "$INPUT_VIDEO" \
       -i "$WATERMARK_IMG" \
       -map_metadata -1 \
       -filter_complex "[1:v]scale=iw*$SCALE:-1[wm];[0:v][wm]overlay=$COORD" \
       -c:v libx264 -preset fast -crf 28 \
       -c:a aac -b:a 128k \
       -hide_banner -y \
       "$OUTPUT_FILE"

if [ $? -eq 0 ]; then
    echo "Successfully created $OUTPUT_FILE"
else
    echo "Error processing $INPUT_VIDEO"
    exit 1
fi
