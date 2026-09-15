from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from routers import demand, price, routing, simulation  # noqa: E402

app = FastAPI(title="BharatPure Decision Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000"],  # the Node backend only -- frontend never calls this directly
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(demand.router, prefix="/demand", tags=["Demand Intelligence"])
app.include_router(price.router, prefix="/price", tags=["Price Intelligence"])
app.include_router(routing.router, prefix="/routing", tags=["Route Optimization"])
app.include_router(simulation.router, prefix="/simulation", tags=["What-if Simulator"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "BharatPure Decision Engine"}
