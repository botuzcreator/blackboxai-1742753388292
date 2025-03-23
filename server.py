from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
import requests
import cgi
import io
import os
from urllib.parse import parse_qs, urlparse

class ProxyHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Set the directory to serve files from
        self.directory = os.getcwd()
        super().__init__(*args, **kwargs)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def do_POST(self):
        if self.path.startswith('/detect'):
            try:
                # Get content length
                content_length = int(self.headers.get('Content-Length', 0))
                if content_length == 0:
                    self.send_error(400, 'No content received')
                    return

                # Read the form data
                form_data = self.rfile.read(content_length)
                
                # Forward to Roboflow API
                roboflow_url = "https://detect.roboflow.com/fire-smoke-lzyry/1"
                params = {
                    'api_key': 'ciSchdhbsl8byA6gKCNh'
                }
                
                headers = {
                    'Content-Type': self.headers.get('Content-Type', '')
                }
                
                response = requests.post(roboflow_url, 
                                      params=params, 
                                      data=form_data, 
                                      headers=headers)
                
                if response.status_code == 200:
                    self.send_response(200)
                    self.send_cors_headers()
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(response.content)
                else:
                    print(f"Roboflow API error: {response.status_code}")
                    print(f"Response content: {response.content}")
                    self.send_error(response.status_code, 'Roboflow API error')
                return
            except Exception as e:
                print(f"Error processing request: {str(e)}")
                self.send_error(500, f'Internal server error: {str(e)}')
                return

        return super().do_POST()

    def do_GET(self):
        # Handle root path
        if self.path == '/' or self.path.startswith('/?'):
            self.path = '/index.html'
        
        try:
            return super().do_GET()
        except Exception as e:
            print(f"Error serving file: {str(e)}")
            self.send_error(404, f'File not found')

    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def log_message(self, format, *args):
        # Override to provide more detailed logging
        print(f"{self.log_date_time_string()} - {self.address_string()} - {format%args}")

if __name__ == '__main__':
    server_address = ('', 8000)
    httpd = HTTPServer(server_address, ProxyHandler)
    print('Server running on port 8000...')
    print(f'Serving files from: {os.getcwd()}')
    httpd.serve_forever()