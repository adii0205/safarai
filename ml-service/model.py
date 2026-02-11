import os
import pickle
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from xgboost import XGBClassifier, XGBRegressor
from sklearn.preprocessing import LabelEncoder

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")


class ReliabilityPredictor:
    def __init__(self):
        self.delay_model = None
        self.cancel_model = None
        self.transport_encoder = LabelEncoder()
        self.season_encoder = LabelEncoder()
        self.time_encoder = LabelEncoder()
        self.is_loaded = False

    def _get_season(self, date_str: str) -> str:
        try:
            month = datetime.strptime(date_str, "%Y-%m-%d").month
        except Exception:
            month = 6
        if month in [3, 4, 5]:
            return "summer"
        elif month in [6, 7, 8, 9]:
            return "monsoon"
        elif month in [10, 11]:
            return "spring"
        else:
            return "winter"

    def _get_weekday(self, date_str: str) -> int:
        try:
            return datetime.strptime(date_str, "%Y-%m-%d").weekday()
        except Exception:
            return 3

    def _route_hash(self, route: str) -> float:
        """Deterministic hash for route string to numeric feature."""
        return sum(ord(c) for c in route) % 1000 / 1000.0

    def _generate_training_data(self, n_samples: int = 5000) -> pd.DataFrame:
        """Generate realistic synthetic training data based on Indian transport patterns."""
        np.random.seed(42)

        transport_types = ["train", "bus", "flight"]
        seasons = ["summer", "monsoon", "winter", "spring"]
        times = ["morning", "afternoon", "evening", "night"]

        routes = [
            "Mumbai-Delhi", "Delhi-Bangalore", "Chennai-Kolkata",
            "Pune-Mumbai", "Hyderabad-Bangalore", "Delhi-Jaipur",
            "Mumbai-Goa", "Chennai-Bangalore", "Kolkata-Delhi",
            "Ahmedabad-Mumbai", "Lucknow-Delhi", "Varanasi-Patna",
            "Bhopal-Indore", "Kochi-Bangalore", "Mumbai-Pune",
        ]

        data = []
        for _ in range(n_samples):
            transport = np.random.choice(transport_types)
            season = np.random.choice(seasons)
            time = np.random.choice(times)
            weekday = np.random.randint(0, 7)
            route = np.random.choice(routes)

            # Realistic delay patterns for India
            base_delay_prob = {
                "train": 0.40,  # Indian trains are famously delayed
                "bus": 0.30,
                "flight": 0.15,
            }[transport]

            # Monsoon increases delays significantly
            if season == "monsoon":
                base_delay_prob += 0.15
            elif season == "winter":
                base_delay_prob += 0.05  # Fog delays

            # Night services slightly less delayed
            if time == "night":
                base_delay_prob -= 0.05
            elif time == "morning":
                base_delay_prob += 0.05

            # Weekend effect
            if weekday in [5, 6]:
                base_delay_prob += 0.05

            is_delayed = 1 if np.random.random() < base_delay_prob else 0
            delay_minutes = max(0, np.random.exponential(
                {"train": 45, "bus": 30, "flight": 20}[transport]
            )) if is_delayed else 0

            # Cancellation patterns
            base_cancel_prob = {
                "train": 0.03,
                "bus": 0.05,
                "flight": 0.02,
            }[transport]

            if season == "monsoon":
                base_cancel_prob += 0.05
            if season == "winter":
                base_cancel_prob += 0.02

            is_cancelled = 1 if np.random.random() < base_cancel_prob else 0

            data.append({
                "route_hash": self._route_hash(route),
                "transport_type": transport,
                "season": season,
                "time_of_day": time,
                "weekday": weekday,
                "is_delayed": is_delayed,
                "delay_minutes": delay_minutes,
                "is_cancelled": is_cancelled,
            })

        return pd.DataFrame(data)

    def load_or_train(self):
        os.makedirs(MODEL_DIR, exist_ok=True)
        delay_path = os.path.join(MODEL_DIR, "delay_model.pkl")
        cancel_path = os.path.join(MODEL_DIR, "cancel_model.pkl")
        encoders_path = os.path.join(MODEL_DIR, "encoders.pkl")

        if os.path.exists(delay_path) and os.path.exists(cancel_path):
            with open(delay_path, "rb") as f:
                self.delay_model = pickle.load(f)
            with open(cancel_path, "rb") as f:
                self.cancel_model = pickle.load(f)
            with open(encoders_path, "rb") as f:
                encoders = pickle.load(f)
                self.transport_encoder = encoders["transport"]
                self.season_encoder = encoders["season"]
                self.time_encoder = encoders["time"]
            self.is_loaded = True
            print("[OK] Models loaded from disk")
        else:
            self.train()

    def train(self):
        print("[TRAINING] Training XGBoost models...")
        df = self._generate_training_data(n_samples=10000)

        # Fit encoders
        self.transport_encoder.fit(["train", "bus", "flight"])
        self.season_encoder.fit(["summer", "monsoon", "winter", "spring"])
        self.time_encoder.fit(["morning", "afternoon", "evening", "night"])

        df["transport_encoded"] = self.transport_encoder.transform(df["transport_type"])
        df["season_encoded"] = self.season_encoder.transform(df["season"])
        df["time_encoded"] = self.time_encoder.transform(df["time_of_day"])

        features = ["route_hash", "transport_encoded", "season_encoded", "time_encoded", "weekday"]
        X = df[features]

        # Train delay prediction model
        y_delay = df["is_delayed"]
        self.delay_model = XGBClassifier(
            n_estimators=200,
            max_depth=6,
            learning_rate=0.1,
            random_state=42,
            eval_metric="logloss",
        )
        self.delay_model.fit(X, y_delay)

        # Train cancellation prediction model
        y_cancel = df["is_cancelled"]
        self.cancel_model = XGBClassifier(
            n_estimators=200,
            max_depth=5,
            learning_rate=0.1,
            random_state=42,
            eval_metric="logloss",
        )
        self.cancel_model.fit(X, y_cancel)

        # Save models
        with open(os.path.join(MODEL_DIR, "delay_model.pkl"), "wb") as f:
            pickle.dump(self.delay_model, f)
        with open(os.path.join(MODEL_DIR, "cancel_model.pkl"), "wb") as f:
            pickle.dump(self.cancel_model, f)
        with open(os.path.join(MODEL_DIR, "encoders.pkl"), "wb") as f:
            pickle.dump({
                "transport": self.transport_encoder,
                "season": self.season_encoder,
                "time": self.time_encoder,
            }, f)

        self.is_loaded = True
        print("[OK] Models trained and saved")

    def _prepare_features(self, route: str, transport_type: str, date: str, time_of_day: str) -> np.ndarray:
        route_hash = self._route_hash(route)
        transport_enc = self.transport_encoder.transform([transport_type])[0]
        season = self._get_season(date)
        season_enc = self.season_encoder.transform([season])[0]
        time_enc = self.time_encoder.transform([time_of_day])[0]
        weekday = self._get_weekday(date)

        return np.array([[route_hash, transport_enc, season_enc, time_enc, weekday]])

    def predict_delay(self, route: str, transport_type: str, date: str, time_of_day: str = "morning") -> dict:
        if not self.is_loaded:
            return {
                "delay_probability": 0.3,
                "expected_delay_minutes": 25.0,
                "reliability_score": 70.0,
            }

        X = self._prepare_features(route, transport_type, date, time_of_day)
        delay_prob = float(self.delay_model.predict_proba(X)[0][1])
        expected_delay = delay_prob * {"train": 45, "bus": 30, "flight": 20}.get(transport_type, 30)
        reliability = max(0, min(100, 100 - (delay_prob * 60)))

        return {
            "delay_probability": round(delay_prob, 4),
            "expected_delay_minutes": round(expected_delay, 1),
            "reliability_score": round(reliability, 1),
        }

    def predict_cancellation(self, route: str, transport_type: str, date: str, time_of_day: str = "morning") -> dict:
        if not self.is_loaded:
            return {
                "cancellation_probability": 0.05,
                "reliability_score": 75.0,
            }

        X = self._prepare_features(route, transport_type, date, time_of_day)
        cancel_prob = float(self.cancel_model.predict_proba(X)[0][1])
        reliability = max(0, min(100, 100 - (cancel_prob * 200)))

        return {
            "cancellation_probability": round(cancel_prob, 4),
            "reliability_score": round(reliability, 1),
        }
