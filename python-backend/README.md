# Soccer Video Analysis - Python Backend

FastAPI backend with OpenCV for accurate homography calculations in soccer video analysis.

## Quick Start

### 1. Install Dependencies

```bash
cd python-backend
pip install -r requirements.txt
```

### 2. Run the Server

```bash
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`

### 3. Connect to Frontend

Set the environment variable in your Lovable project:

```env
VITE_PYTHON_API_ENDPOINT=http://localhost:8000
```

Or for production deployment, use your deployed URL.

## API Endpoints

### `POST /calibrate`

Compute homography matrix from point correspondences.

**Request:**
```json
{
  "video_points": [[100, 200], [500, 200], [500, 400], [100, 400]],
  "pitch_points": [[0, 0], [105, 0], [105, 68], [0, 68]],
  "session_id": "optional-session-id"
}
```

**Response:**
```json
{
  "success": true,
  "matrix": [[...], [...], [...]],
  "reprojection_error": 0.5,
  "message": "Calibration successful with 4 points..."
}
```

### `POST /transform`

Transform video coordinate to pitch coordinate.

**Request:**
```json
{
  "video_point": [300, 300],
  "matrix": [[...], [...], [...]]
}
```

**Response:**
```json
{
  "pitch_point": [52.5, 34.0],
  "success": true
}
```

### `POST /distance`

Calculate real-world distance between two video points.

**Request:**
```json
{
  "point1": [100, 200],
  "point2": [400, 350],
  "matrix": [[...], [...], [...]]
}
```

**Response:**
```json
{
  "distance": 18.5,
  "pitch_point1": [20.0, 30.0],
  "pitch_point2": [38.5, 30.0],
  "success": true
}
```

### `POST /batch-transform`

Transform multiple points at once.

**Request:**
```json
{
  "video_points": [[100, 200], [200, 300], [300, 400]],
  "matrix": [[...], [...], [...]]
}
```

### `POST /inverse-transform`

Transform pitch coordinate back to video coordinate.

## Deployment Options

### Railway

1. Push to GitHub
2. Connect to Railway
3. Add Python buildpack
4. Set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Render

1. Create new Web Service
2. Connect repo
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Docker

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## How Homography Works

The homography matrix H is a 3x3 transformation matrix that maps points from video space to pitch space:

```
[pitch_x]       [video_x]
[pitch_y] = H × [video_y]
[  1   ]       [   1   ]
```

OpenCV's `findHomography` with RANSAC provides robust estimation even with some calibration errors.

### Calibration Tips

1. **Use 6+ points** for better accuracy
2. **Spread points across the visible area** - don't cluster them
3. **Use clear reference points** - corners, penalty spots, line intersections
4. **Check reprojection error** - should be < 2m for good calibration

## Standard Pitch Reference Points

| Point | X (m) | Y (m) |
|-------|-------|-------|
| Top-Left Corner | 0 | 0 |
| Top-Right Corner | 105 | 0 |
| Bottom-Right Corner | 105 | 68 |
| Bottom-Left Corner | 0 | 68 |
| Center Spot | 52.5 | 34 |
| Left Penalty Spot | 11 | 34 |
| Right Penalty Spot | 94 | 34 |
