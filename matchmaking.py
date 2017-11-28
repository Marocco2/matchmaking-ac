import json
import requests

headers = {"User-Agent": "Assetto Corsa Launcher", ".": "DAB7072BFE38B33F658E7E376CDFAB0F", "Host": "93.57.10.21", "Accept-Encoding": "gzip, deflate", "Connection": "Keep-Alive"}
content = {"guid": "76561197985541827"}
listurl = "http://93.57.10.21/lobby.ashx/list"
pingurl = "http://93.57.10.21/lobby.ashx/ping"

#server list
def GetList():
  global headers, content, listurl
  r = requests.post(url, headers=headers, data=content)
  return r.json()

#ping
def PingEveryServer():
  global headers, content, pingurl
  r = requests.post(url, headers=headers, data=content)
  return r.text