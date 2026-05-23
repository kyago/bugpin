import { createServer } from 'node:http';
const DEFAULT = {
    user: { status: 200, body: { login: 'qa-bot' } },
    repo: { status: 200, body: { full_name: 'o/r' } },
    createIssue: { status: 201, body: { number: 1, html_url: 'http://mock/issues/1' } },
};
let scenario = DEFAULT;
let issueCounter = 0;
function send(res, status, body, extra = {}) {
    res.writeHead(status, { 'Content-Type': 'application/json', ...extra });
    res.end(JSON.stringify(body));
}
const server = createServer((req, res) => {
    if (req.method === 'PUT' && req.url === '/scenario') {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
            try {
                scenario = JSON.parse(body);
                res.writeHead(200);
                res.end('ok');
            }
            catch {
                res.writeHead(400);
                res.end('bad');
            }
        });
        return;
    }
    if (req.url === '/reset') {
        scenario = DEFAULT;
        issueCounter = 0;
        res.writeHead(200);
        res.end('ok');
        return;
    }
    if (req.url?.startsWith('/user')) {
        send(res, scenario.user.status, scenario.user.body ?? {});
        return;
    }
    if (req.url?.startsWith('/repos/') && req.method === 'GET') {
        send(res, scenario.repo.status, scenario.repo.body ?? {});
        return;
    }
    if (req.url?.match(/^\/repos\/[^/]+\/[^/]+\/issues$/) && req.method === 'POST') {
        issueCounter += 1;
        const body = scenario.createIssue.body
            ?? { number: issueCounter, html_url: `http://mock/issues/${issueCounter}` };
        send(res, scenario.createIssue.status, body, scenario.createIssue.headers ?? {});
        return;
    }
    res.writeHead(404);
    res.end('not found');
});
const port = parseInt(process.env.MOCK_PORT ?? '4870', 10);
server.listen(port, () => console.log(`mock-github on :${port}`));
