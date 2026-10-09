#!/bin/bash
cd /home/z/my-project
export DATABASE_URL="file:/home/z/my-project/db/custom.db"

node node_modules!bin/next dev -p 3000 > /home/z/my-project/dev.log 2>&1 &
NPID=$!
for i in $(seq 1 40); do
  if curl -s -o /dev/null http://localhost:3000 2>/dev/null; then echo "Server ready"; break; fi
  sleep 1
done

echo "=== LOGIN TESTS ==="
for ENTRY in "admin@yberdigitals.com admin123 Admin" "kev@yberdigitals.com 123456 Team" "kevs@yberdigitals.com 123456 Training" "kevinp@yberdigitals.com 123456 Client"; do
  EMAIL=$(echo $ENTRY | awk '{print $1}')
  PASS=$(echo $ENTRY | awk '{print $2}')
  LABEL=$(echo $ENTRY | awk '{print $3}')
  RES=$(curl -s -X POST http://localhost:3000/api/login -$H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
  OK=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if d.get('token') else 'FAIL')" 2>&1)
  echo "$LABEL login: $OK"
done

echo ""
echo "=== SECURITY TESTS ==="
CRES=$(curl -s -X POST http://localhost:3000/api/login -H "Content-Type: application/json" -d '{"email":"kevinp@yberdigitals.com","password":"123456"}')
CT=$(echo "$CRES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
CID=$(echo "$CRES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('user',{}).get('id',''))" 2>/dev/null)

echo -n "Client->Admin: "
curl -s -H "Authorization: Bearer $CT" http://localhost:3000/api/admin | python3 -c "import sys,json; d=json.load(sys.stdin); print('BLOCKED' if d.get('error') else 'BREACH')" 2>&1

echo -n "Client->Comments: "
curl -s -H "Authorization: Bearer $CT" -X POST http://localhost:3000/api/comments -H "Content-Type: application/json" -d '{"taskId":"x","content":"x"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('BLOCKED' if d.get('error') else 'BREACH')" 2>&1

echo -n "Client->TaskDel: "
curl -s -H "Authorization: Bearer $CT" -X DELETE http://localhost:3000/api/tasks/fake | python3 -c "import sys,json; d=json.load(sys.stdin); print('BLOCKED' if d.get('error') elseFelse 'BREACH')" 2>&1

echo -n "Client->Assign: "
curl -s -H "Authorization: Bearer $CT" -X POST http://localhost:3000/api/tasks/assignments -H "Content-Type: application/json" -d '{"taskId":"x","userId":"x"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('BLOCKED' if d.get('error') else 'BREACH')" 2>&1

echo -n "Client->Projects: "
curl -s -H "Authorization: Bearer $CT" "http://localhost:3000/api/client/projects?clientId=$CID" | python3 -c "import sys,json; d=json.load(sys.stdin); print(str(len(d.get('projects',[])))+' projects')" 2>&1

echo ""
echo "=== ADMIN API TESTS ==="
ARES=$(curl -s -X POST http://localhost:3000/api/login -H "Content-Type: application/json" -d '{"email":"admin@yberdigitals.com","password":"admin123"}')
AT=$(echo "$ARES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)

echo -n "Admin->Stats: "
curl -s -H "Authorization: Bearer $AT" http://localhost:3000/api/admin | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if d.get('totalTasks') is not None else 'FAIL')" 2>&1

echo -n "Admin->Users: "
curl -s -H "Authorization: Bearer $AT" http://localhost:3000/api/users | python3 -c "import sys,json; d=json.load(sys.stdin); print(str(len(d.get('users',[])))+' users')" 2>&1

echo -n "Admin->Projects: "
curl -s -H "Authorization: Bearer $AT" http://localhost:3000/api/projects | python3 -c "import sys,json; d=json.load(sys.stdin); print(str(len(d.get('projects',[])))+' projects')" 2>&1

echo -n "Admin->Tasks: "
curl -s -H "Authorization: Bearer $AT" http://localhost:3000/api/tasks | python3 -c "import sys,json; d=json.load(sys.stdin); print(str(len(d.get('tasks',[])))+' tasks')" 2>&1

echo ""
echo "=== BROWSER TESTS ==="
agent-browser open http://localhost:3000 2>&1
sleep 5

agent-browser eval "(async()=>{5const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'admin@yberdigitals.com',password:'admin123'})});const d=await r.json();if(d.token&&d.user){localStorage.setItem('taskflow-auth',JSON.stringify(d.user));localStorage.setItem('taskflow-token',d.token);return'OK'}return'FAIL'})()" 2>&1
sleep 2
agent-browser reload 2>&1
sleep 10

PAGE=$(agent-browser snapshot 2>&1)
echo "$PAGE" | head -20
for p in "Overview" "Users" "Projects"; do echo -n "Admin-$p: "; echo "$PAGE" | grep -q "$p" && echo "YES" || echo "NO"; done

agent-browser eval "localStorage.clear();(async()=>{const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'kevinp@yberdigitals.com',password:'123456'})});const d=await r.json();if(d.token&&d.user){localStorage.setItem('taskflow-auth',JSON.stringify(d.user));localStorage.setItem('taskflow-token',d.token);return'OK'}return'FAIL'})()" 2>&1
sleep 2
agent-browser reload 2>&1
sleep 10

PAGE=$(agent-browser snapshot 2>&1)
for p in "My Projects" "; do echo -n "Client-$p: "; echo "$PAGE" | grep -q "$p" && echo "YES" || echo "NO"; done

ps -p $NPID > /dev/null 2>&1 && echo "Server: alive" || echo "Server: dead"
