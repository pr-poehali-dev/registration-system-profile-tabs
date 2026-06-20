import json
import os
import hashlib
import psycopg2
from psycopg2.extras import RealDictCursor


def parse_user_id(token: str):
    if not token or '.' not in token:
        return None
    try:
        return int(token.split('.')[0])
    except ValueError:
        return None


def handler(event: dict, context) -> dict:
    '''Получение и создание пропусков пользователя'''
    method = event.get('httpMethod', 'GET')
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
        'Content-Type': 'application/json'
    }
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    headers = event.get('headers', {})
    token = headers.get('X-Auth-Token') or headers.get('x-auth-token')
    user_id = parse_user_id(token)
    if not user_id:
        return {'statusCode': 401, 'headers': cors,
                'body': json.dumps({'error': 'Не авторизован'})}

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True
    try:
        if method == 'GET':
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT id, visitor_name, purpose, visit_date::text, status, created_at::text "
                    "FROM passes WHERE user_id = %s ORDER BY created_at DESC",
                    (user_id,)
                )
                rows = cur.fetchall()
            return {'statusCode': 200, 'headers': cors,
                    'body': json.dumps({'passes': [dict(r) for r in rows]})}

        if method == 'POST':
            body = json.loads(event.get('body') or '{}')
            visitor_name = (body.get('visitor_name') or '').strip()
            purpose = (body.get('purpose') or '').strip()
            visit_date = (body.get('visit_date') or '').strip()
            if not visitor_name or not visit_date:
                return {'statusCode': 400, 'headers': cors,
                        'body': json.dumps({'error': 'Укажите имя посетителя и дату'})}
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "INSERT INTO passes (user_id, visitor_name, purpose, visit_date) "
                    "VALUES (%s, %s, %s, %s) "
                    "RETURNING id, visitor_name, purpose, visit_date::text, status, created_at::text",
                    (user_id, visitor_name, purpose, visit_date)
                )
                row = cur.fetchone()
            return {'statusCode': 200, 'headers': cors,
                    'body': json.dumps({'pass': dict(row)})}

        return {'statusCode': 405, 'headers': cors,
                'body': json.dumps({'error': 'Метод не поддерживается'})}
    finally:
        conn.close()
