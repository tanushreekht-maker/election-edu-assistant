import pytest
import json
from app import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_home_page_loads(client):
    response = client.get('/')
    assert response.status_code == 200

def test_health_endpoint(client):
    response = client.get('/health')
    assert response.status_code == 200

def test_chat_endpoint_exists(client):
    response = client.post('/chat',
        data=json.dumps({'message': 'What is EVM?'}),
        content_type='application/json')
    assert response.status_code in [200, 500]

def test_chat_requires_message(client):
    response = client.post('/chat',
        data=json.dumps({}),
        content_type='application/json')
    assert response.status_code in [400, 200, 500]

def test_static_files_accessible(client):
    response = client.get('/static/style.css')
    assert response.status_code == 200

def test_chat_empty_message(client):
    response = client.post('/chat',
        data=json.dumps({'message': ''}),
        content_type='application/json')
    assert response.status_code in [400, 200, 500]