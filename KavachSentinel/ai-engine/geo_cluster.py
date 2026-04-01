import json
import random

# Mock IP to India Geo-Mapping
INDIA_CITIES = [
    {"name": "Delhi NCR", "lat": 28.7041, "lng": 77.1025},
    {"name": "Mumbai", "lat": 19.0760, "lng": 72.8777},
    {"name": "Bangalore", "lat": 12.9716, "lng": 77.5946},
    {"name": "Chennai", "lat": 13.0827, "lng": 80.2707},
    {"name": "Kolkata", "lat": 22.5726, "lng": 88.3639}
]

def map_ip_to_geo(ip_address):
    # Hash IP to a consistent city
    hash_val = sum([ord(c) for c in str(ip_address)])
    city = INDIA_CITIES[hash_val % len(INDIA_CITIES)]
    
    # Add slight jitter for clustering visual
    lat = city['lat'] + random.uniform(-0.1, 0.1)
    lng = city['lng'] + random.uniform(-0.1, 0.1)
    
    return {
        "ip": ip_address,
        "region": city['name'],
        "coordinates": [lat, lng]
    }

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        print(json.dumps(map_ip_to_geo(sys.argv[1])))
    else:
        print(json.dumps(map_ip_to_geo("192.168.1.1")))
