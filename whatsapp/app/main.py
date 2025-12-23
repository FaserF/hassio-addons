from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from whatsapp_client import WhatsAppApiClient
import asyncio

app = FastAPI()
client = WhatsAppApiClient()

class MessageRequest(BaseModel):
    number: str
    message: str

@app.on_event("startup")
async def startup_event():
    # Attempt to initialize/connect on start
    asyncio.create_task(client.initialize_browser())

@app.on_event("shutdown")
async def shutdown_event():
    await client.close()

@app.get("/qr")
async def get_qr():
    qr = await client.get_qr_code()
    if not qr:
         if await client.is_connected():
             return {"status": "connected", "qr": None}
         raise HTTPException(status_code=503, detail="QR generation failed or timeout")
    return {"status": "scanning", "qr": qr}

@app.get("/status")
async def get_status():
    connected = await client.is_connected()
    return {"connected": connected}

@app.post("/send_message")
async def send_message(msg: MessageRequest):
    if not await client.is_connected():
        raise HTTPException(status_code=503, detail="Not connected to WhatsApp")

    try:
        await client.send_message(msg.number, msg.message)
        return {"status": "sent"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Host 0.0.0.0 is crucial for Docker
    uvicorn.run(app, host="0.0.0.0", port=8000)
