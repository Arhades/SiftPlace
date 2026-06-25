# SiftPlace backend — a minimal container. This is your Docker starting point.
#
# Build:  docker build -t siftplace-api .
# Run:    docker run -p 8000:8000 siftplace-api
# Then:   open http://localhost:8000/health
FROM python:3.12-slim

# Don't write .pyc files; flush logs straight to the terminal.
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

WORKDIR /app

# Install deps first so Docker can cache this layer when only code changes.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend.
COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
