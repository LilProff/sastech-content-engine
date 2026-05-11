import json
import httpx
import os
from typing import TypedDict, List, Dict, Any, Literal
from langgraph.graph import StateGraph, END

# --- STATE DEFINITION ---
class JarvisState(TypedDict):
    category: str
    raw_update: str
    tasks: List[Dict[str, Any]]
    results: List[str]

OPENROUTER_KEY = os.getenv("OPENROUTER_API_KEY", "")

# --- HELPER FUNCTION TO CALL LLM ---
async def call_llm(system_prompt: str, user_prompt: str) -> str:
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {OPENROUTER_KEY}"},
                json={
                    "model": "meta-llama/llama-3.3-70b-instruct:free",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ]
                },
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"LLM Error: {e}")
            return "{}"

# --- NODE: SUPERVISOR ---
async def supervisor_node(state: JarvisState) -> Dict[str, Any]:
    system_prompt = """You are the Jarvis Supervisor.
Analyze the user's update and determine which agents need to run.
Return ONLY a JSON array of tasks. Available agents: "DocUpdater", "JobApplicator", "ContentPublisher", "PortfolioSyncer".
Format: [{"agent": "DocUpdater", "action": "Add LangGraph to CV"}]"""
    
    user_prompt = f"Category: {state['category']}\nUpdate: {state['raw_update']}"
    result = await call_llm(system_prompt, user_prompt)
    
    try:
        tasks = json.loads(result.replace('```json', '').replace('```', '').strip())
    except Exception:
        tasks = []
        
    return {"tasks": tasks}

# --- ROUTER FUNCTION ---
def router(state: JarvisState) -> List[str]:
    # Returns the list of nodes to execute next based on the supervisor's output
    destinations = []
    for task in state["tasks"]:
        agent = task.get("agent")
        if agent in ["DocUpdater", "JobApplicator", "ContentPublisher", "PortfolioSyncer"]:
            destinations.append(agent)
            
    if not destinations:
        return ["__end__"]
    return destinations

# --- EXECUTION NODES ---
async def doc_updater_node(state: JarvisState) -> Dict[str, Any]:
    # TODO: Connect to Google Docs or python-docx
    print("Executing DocUpdater...")
    return {"results": ["CV updated successfully."]}

async def job_applicator_node(state: JarvisState) -> Dict[str, Any]:
    # TODO: Connect to BeautifulSoup / SMTP
    print("Executing JobApplicator...")
    return {"results": ["Scraped 5 jobs, applied to 2."]}

async def content_publisher_node(state: JarvisState) -> Dict[str, Any]:
    # TODO: Connect to LinkedIn API
    print("Executing ContentPublisher...")
    return {"results": ["Drafted LinkedIn post."]}

async def portfolio_syncer_node(state: JarvisState) -> Dict[str, Any]:
    # TODO: Connect to GitHub PyGithub
    print("Executing PortfolioSyncer...")
    return {"results": ["Pushed case study to GitHub."]}

# --- BUILD THE GRAPH ---
workflow = StateGraph(JarvisState)

workflow.add_node("Supervisor", supervisor_node)
workflow.add_node("DocUpdater", doc_updater_node)
workflow.add_node("JobApplicator", job_applicator_node)
workflow.add_node("ContentPublisher", content_publisher_node)
workflow.add_node("PortfolioSyncer", portfolio_syncer_node)

workflow.set_entry_point("Supervisor")

# The router determines which execution nodes to run in parallel
workflow.add_conditional_edges("Supervisor", router)

# All execution nodes return to END
workflow.add_edge("DocUpdater", END)
workflow.add_edge("JobApplicator", END)
workflow.add_edge("ContentPublisher", END)
workflow.add_edge("PortfolioSyncer", END)

# Compile the graph
jarvis_graph = workflow.compile()
