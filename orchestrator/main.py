from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from graph import jarvis_graph
import os
import json

app = FastAPI(title="Jarvis LangGraph Orchestrator", version="1.0")

# Request Model
class MemoryPayload(BaseModel):
    category: str
    raw_update: str

@app.get("/")
def read_root():
    return {"status": "LangGraph Orchestrator is Online"}

@app.post("/api/ingest")
async def ingest_memory(payload: MemoryPayload):
    """
    Triggers the LangGraph execution.
    1. Passes input to Supervisor.
    2. Supervisor routes to Python sub-agents.
    3. Agents execute and update State.
    """
    
    # Initialize the graph state
    initial_state = {
        "category": payload.category,
        "raw_update": payload.raw_update,
        "tasks": [],
        "results": []
    }

    try:
        # Run the graph asynchronously
        final_state = await jarvis_graph.ainvoke(initial_state)
        
        # Here we would normally sync final_state["results"] to Supabase
        
        return {
            "status": "success", 
            "tasks_identified": final_state.get("tasks", []),
            "execution_results": final_state.get("results", [])
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
