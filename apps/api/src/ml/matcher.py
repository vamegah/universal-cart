# Simple placeholder for Python matching microservice
import sys
import json

if __name__ == "__main__":
    input_data = json.loads(sys.stdin.read())
    # dummy similarity
    print(json.dumps({"similarity": 0.85}))