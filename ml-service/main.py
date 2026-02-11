from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from model import ReliabilityPredictor
import uvicorn

app = FastAPI(
    title="SafarAI ML Service",
    description="XGBoost-powered transport reliability prediction for Indian routes",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the trained model
predictor = ReliabilityPredictor()
predictor.load_or_train()


class PredictionRequest(BaseModel):
    route: str
    transport_type: str  # train, bus, flight
    date: str  # YYYY-MM-DD
    time_of_day: str = "morning"  # morning, afternoon, evening, night


class DelayResponse(BaseModel):
    route: str
    transport_type: str
    delay_probability: float
    expected_delay_minutes: float
    reliability_score: float


class CancellationResponse(BaseModel):
    route: str
    transport_type: str
    cancellation_probability: float
    reliability_score: float


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "SafarAI ML Service",
        "model_loaded": predictor.is_loaded,
        "version": "1.0.0"
    }


@app.post("/predict-delay", response_model=DelayResponse)
async def predict_delay(request: PredictionRequest):
    result = predictor.predict_delay(
        route=request.route,
        transport_type=request.transport_type,
        date=request.date,
        time_of_day=request.time_of_day,
    )
    return DelayResponse(
        route=request.route,
        transport_type=request.transport_type,
        delay_probability=result["delay_probability"],
        expected_delay_minutes=result["expected_delay_minutes"],
        reliability_score=result["reliability_score"],
    )


@app.post("/predict-cancellation", response_model=CancellationResponse)
async def predict_cancellation(request: PredictionRequest):
    result = predictor.predict_cancellation(
        route=request.route,
        transport_type=request.transport_type,
        date=request.date,
        time_of_day=request.time_of_day,
    )
    return CancellationResponse(
        route=request.route,
        transport_type=request.transport_type,
        cancellation_probability=result["cancellation_probability"],
        reliability_score=result["reliability_score"],
    )


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
