# MatchMaking for Assetto Corsa
# Developed by Marco "Atrip3" Mollace
# Thanks to Stefan Mizzi for providing awesome advices
# Version 0.0

import json
import requests

headers = {"User-Agent": "Assetto Corsa Launcher", ".": "DAB7072BFE38B33F658E7E376CDFAB0F", "Host": "93.57.10.21", "Accept-Encoding": "gzip, deflate", "Connection": "Keep-Alive"}
content = {"guid": "76561197985541827"}
listurl = "http://93.57.10.21/lobby.ashx/list"
pingurl = "http://93.57.10.21/lobby.ashx/ping"
mrurl= "http://www.minorating.com/MRServerLobbyAPI"

#server list
def GetKunosList():
    global headers, content, listurl
    r = requests.post(listurl, headers=headers, data=content)
    #r.encoding = 'utf-8'
    return r.content

#ping
def PingEveryServer():
    global headers, content, pingurl
    r = requests.post(pingurl, headers=headers, data=content)
    #r.encoding = 'utf-8'
    return r.text

# MinoRating server list
def GetMRServer():
    global mrurl
    r = requests.get(mrurl)
    return r.content

def CompatibleCars(server):
    # Compares server car list with local car list
    return null

def SelectServer():
    listMR = GetMRServer()
    # filter jq 'map(select(.cars[] == "ferrari_458_gt2")) | map(select( .track == "spa[]")) | max_by(.clients)'
    # should be this map(select(.cars[] == "ferrari_458_gt2")) | map(select( .track == "spa[]")) | map(select( .pass == false)) | max_by(.clients)
    # but Minolin didn't fix a bug
    # before finishing we check compatible cars

    server = listMR #filtered propely
    #compatible = CompatibleCars(server)

    if server != null:
        server.ip = server
        server.title = server

        # here shows server info

        # here starts countdown of 15 seconds

        JoinServer(server.ip)
    else:
        listKS = GetKunosList()
        # filter jq map(select(.cars[] == "ferrari_458_gt2")) | map(select( .track == "spa")) | map(select( .pass == false)) | max_by(.clients)
        # REMEMBER!!! TRACKS AREN'T THE SAME: MR ENDS WITH [layout] WHEN KUNOS WITH -layout
        server = listKS

def JoinServer(server_ip):
    return null

with open("results.json", mode='w') as f:
    #f.write(str(GetList()))
    f.write(GetKunosList())
    #f.write(GetMRServer())
