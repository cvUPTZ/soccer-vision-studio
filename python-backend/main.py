"""
Soccer Video Analysis - Python Backend
Provides homography calculations using OpenCV for accurate
coordinate transformation and distance measurements.

Run with: uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import cv2
from typing import List, Tuple, Optional

app = FastAPI(
    title="Soccer Video Analysis API",
    description="Homography and coordinate transformation for soccer video annotation",
    version="1.0.0"
)

# Enable CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store active homography matrices per session
homography_store: dict[str, np.ndarray] = {}


class CalibrationRequest(BaseModel):
    """Request body for calibration endpoint"""
    video_points: List[List[float]]  # [[x1, y1], [x2, y2], ...]
    pitch_points: List[List[float]]  # [[x1, y1], [x2, y2], ...]
    session_id: Optional[str] = "default"


class CalibrationResponse(BaseModel):
    """Response from calibration endpoint"""
    success: bool
    matrix: List[List[float]]
    reprojection_error: float
    message: str


class TransformRequest(BaseModel):
    """Request body for coordinate transformation"""
    video_point: List[float]  # [x, y]
    matrix: Optional[List[List[float]]] = None
    session_id: Optional[str] = "default"


class TransformResponse(BaseModel):
    """Response from transform endpoint"""
    pitch_point: List[float]  # [x, y] in meters
    success: bool


class DistanceRequest(BaseModel):
    """Request body for distance calculation"""
    point1: List[float]  # [video_x, video_y]
    point2: List[float]  # [video_x, video_y]
    matrix: Optional[List[List[float]]] = None
    session_id: Optional[str] = "default"


class DistanceResponse(BaseModel):
    """Response from distance endpoint"""
    distance: float  # in meters
    pitch_point1: List[float]
    pitch_point2: List[float]
    success: bool


class BatchTransformRequest(BaseModel):
    """Request body for batch transformation"""
    video_points: List[List[float]]
    matrix: Optional[List[List[float]]] = None
    session_id: Optional[str] = "default"


class BatchTransformResponse(BaseModel):
    """Response from batch transform endpoint"""
    pitch_points: List[List[float]]
    success: bool


def compute_homography(
    video_points: List[List[float]], 
    pitch_points: List[List[float]]
) -> Tuple[np.ndarray, float]:
    """
    Compute homography matrix using OpenCV's findHomography.
    Uses RANSAC for robust estimation.
    
    Args:
        video_points: List of [x, y] coordinates in video space
        pitch_points: List of [x, y] coordinates in pitch space (meters)
    
    Returns:
        Tuple of (homography matrix, reprojection error)
    """
    src_pts = np.array(video_points, dtype=np.float32)
    dst_pts = np.array(pitch_points, dtype=np.float32)
    
    # Use RANSAC for robust estimation (handles outliers)
    H, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)
    
    if H is None:
        raise ValueError("Could not compute homography matrix")
    
    # Calculate reprojection error
    src_pts_homogeneous = np.hstack([src_pts, np.ones((len(src_pts), 1))])
    projected = (H @ src_pts_homogeneous.T).T
    projected = projected[:, :2] / projected[:, 2:3]
    
    error = np.sqrt(np.mean(np.sum((projected - dst_pts) ** 2, axis=1)))
    
    return H, float(error)


def transform_point(
    video_point: List[float], 
    H: np.ndarray
) -> List[float]:
    """
    Transform a video coordinate to pitch coordinate using homography.
    
    Args:
        video_point: [x, y] in video space
        H: 3x3 homography matrix
    
    Returns:
        [x, y] in pitch space (meters)
    """
    pt = np.array([[video_point[0], video_point[1], 1.0]], dtype=np.float32).T
    transformed = H @ pt
    
    # Convert from homogeneous coordinates
    x = transformed[0, 0] / transformed[2, 0]
    y = transformed[1, 0] / transformed[2, 0]
    
    return [float(x), float(y)]


def calculate_pitch_distance(
    point1: List[float], 
    point2: List[float]
) -> float:
    """
    Calculate Euclidean distance between two pitch points in meters.
    """
    dx = point2[0] - point1[0]
    dy = point2[1] - point1[1]
    return float(np.sqrt(dx**2 + dy**2))


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "Soccer Video Analysis API",
        "version": "1.0.0"
    }


@app.post("/calibrate", response_model=CalibrationResponse)
async def calibrate(request: CalibrationRequest):
    """
    Compute homography matrix from video-pitch point correspondences.
    
    Requires at least 4 point pairs. More points = better accuracy.
    Uses RANSAC algorithm for robust estimation.
    
    Returns the 3x3 homography matrix and reprojection error.
    """
    if len(request.video_points) < 4 or len(request.pitch_points) < 4:
        raise HTTPException(
            status_code=400, 
            detail="At least 4 calibration points are required"
        )
    
    if len(request.video_points) != len(request.pitch_points):
        raise HTTPException(
            status_code=400, 
            detail="Number of video points must match number of pitch points"
        )
    
    try:
        H, error = compute_homography(request.video_points, request.pitch_points)
        
        # Store matrix for this session
        homography_store[request.session_id] = H
        
        return CalibrationResponse(
            success=True,
            matrix=H.tolist(),
            reprojection_error=error,
            message=f"Calibration successful with {len(request.video_points)} points. "
                   f"Reprojection error: {error:.2f}m"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/transform", response_model=TransformResponse)
async def transform(request: TransformRequest):
    """
    Transform a video coordinate to pitch coordinate.
    
    Uses the homography matrix from calibration.
    Returns coordinates in meters on the pitch.
    """
    H = None
    
    if request.matrix:
        H = np.array(request.matrix, dtype=np.float32)
    elif request.session_id in homography_store:
        H = homography_store[request.session_id]
    
    if H is None:
        raise HTTPException(
            status_code=400, 
            detail="No homography matrix available. Calibrate first or provide matrix."
        )
    
    try:
        pitch_point = transform_point(request.video_point, H)
        return TransformResponse(pitch_point=pitch_point, success=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/distance", response_model=DistanceResponse)
async def distance(request: DistanceRequest):
    """
    Calculate real-world distance between two video points.
    
    Transforms both points to pitch coordinates using homography,
    then calculates Euclidean distance in meters.
    """
    H = None
    
    if request.matrix:
        H = np.array(request.matrix, dtype=np.float32)
    elif request.session_id in homography_store:
        H = homography_store[request.session_id]
    
    if H is None:
        raise HTTPException(
            status_code=400, 
            detail="No homography matrix available. Calibrate first or provide matrix."
        )
    
    try:
        pitch_point1 = transform_point(request.point1, H)
        pitch_point2 = transform_point(request.point2, H)
        dist = calculate_pitch_distance(pitch_point1, pitch_point2)
        
        return DistanceResponse(
            distance=round(dist, 1),
            pitch_point1=pitch_point1,
            pitch_point2=pitch_point2,
            success=True
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/batch-transform", response_model=BatchTransformResponse)
async def batch_transform(request: BatchTransformRequest):
    """
    Transform multiple video coordinates to pitch coordinates in one request.
    
    Useful for transforming player positions, trail points, etc.
    """
    H = None
    
    if request.matrix:
        H = np.array(request.matrix, dtype=np.float32)
    elif request.session_id in homography_store:
        H = homography_store[request.session_id]
    
    if H is None:
        raise HTTPException(
            status_code=400, 
            detail="No homography matrix available. Calibrate first or provide matrix."
        )
    
    try:
        pitch_points = [transform_point(vp, H) for vp in request.video_points]
        return BatchTransformResponse(pitch_points=pitch_points, success=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/inverse-transform")
async def inverse_transform(request: TransformRequest):
    """
    Transform a pitch coordinate back to video coordinate.
    
    Useful for placing annotations at specific pitch locations.
    """
    H = None
    
    if request.matrix:
        H = np.array(request.matrix, dtype=np.float32)
    elif request.session_id in homography_store:
        H = homography_store[request.session_id]
    
    if H is None:
        raise HTTPException(
            status_code=400, 
            detail="No homography matrix available. Calibrate first or provide matrix."
        )
    
    try:
        H_inv = np.linalg.inv(H)
        video_point = transform_point(request.video_point, H_inv)
        return {"video_point": video_point, "success": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
