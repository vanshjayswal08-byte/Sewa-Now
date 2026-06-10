# =============================================
#  SEWA NOW — main.py  (Firebase Auth Edition)
#  Flask + Firebase Admin SDK
#  Auth: ID Token verify (Phone OTP + Email/Password via Firebase Auth)
# =============================================

import firebase_admin
from firebase_admin import credentials, firestore, auth as firebase_auth
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime, timezone
from google.cloud.firestore_v1.base_document import DocumentSnapshot  # type: ignore[import]
from functools import wraps
import uuid
import os

app = Flask(__name__)
app.url_map.strict_slashes = False

# ── CORS — handle preflight + add headers to every response ─────────────────
@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        from flask import make_response
        origin = request.headers.get("Origin", "http://127.0.0.1:5501")
        resp = make_response("", 200)
        resp.headers["Access-Control-Allow-Origin"]      = origin
        resp.headers["Access-Control-Allow-Headers"]     = "Content-Type, Authorization, X-Admin-Key"
        resp.headers["Access-Control-Allow-Methods"]     = "GET, POST, PUT, DELETE, OPTIONS"
        resp.headers["Access-Control-Allow-Credentials"] = "true"
        return resp

@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin", "http://127.0.0.1:5501")
    response.headers["Access-Control-Allow-Origin"]      = origin
    response.headers["Access-Control-Allow-Headers"]     = "Content-Type, Authorization, X-Admin-Key"
    response.headers["Access-Control-Allow-Methods"]     = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response



# ── 1. Firebase Initialize ──────────────────────────────────────────────────
cred = credentials.Certificate(
    os.path.join(os.path.dirname(__file__), "serviceAccountKey.json")
)
firebase_admin.initialize_app(cred)
db = firestore.client()


# ── TYPE HELPER ─────────────────────────────────────────────────────────────
def _snap(raw) -> DocumentSnapshot:
    return raw  # type: ignore[return-value]


# ── RESPONSE HELPERS ────────────────────────────────────────────────────────
def success(data, code=200):
    return jsonify({"success": True, "data": data}), code

def error(msg, code=400):
    return jsonify({"success": False, "error": msg}), code

def get_safe_json():
    return request.get_json(silent=True) or {}


# ════════════════════════════════════════════════════════════════════════════
#  AUTH MIDDLEWARE
#  Every protected route sends:  Authorization: Bearer <Firebase ID Token>
#  Backend verifies the token with Firebase Admin SDK (no password stored)
# ════════════════════════════════════════════════════════════════════════════

def require_auth(f):
    """
    Decorator: verifies Firebase ID Token from Authorization header.
    Injects decoded_token into the route via kwargs.
    Usage: @require_auth on any route that needs login.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return error("Missing or invalid Authorization header", 401)

        id_token = auth_header.split("Bearer ")[1].strip()
        try:
            decoded_token = firebase_auth.verify_id_token(id_token)
        except firebase_auth.ExpiredIdTokenError:
            return error("Session expired. Please login again.", 401)
        except firebase_auth.InvalidIdTokenError:
            return error("Invalid token. Please login again.", 401)
        except Exception as e:
            return error(f"Auth error: {str(e)}", 401)

        kwargs["decoded_token"] = decoded_token
        return f(*args, **kwargs)
    return decorated


# ════════════════════════════════════════════════════════════════════════════
#  AUTH ROUTES
# ════════════════════════════════════════════════════════════════════════════

# ── 2. Complete Profile after Firebase Auth signup ───────────────────────────
#  Flow: Firebase Auth (frontend) → get ID token → call /auth/complete-profile
#  This is called ONCE after first login to save name, role, city etc.
@app.route('/auth/complete-profile', methods=['POST'])
@require_auth
def complete_profile(**kwargs):
    try:
        decoded_token = kwargs["decoded_token"]
        data          = get_safe_json()

        uid   = decoded_token["uid"]
        email = decoded_token.get("email", "")
        phone = decoded_token.get("phone_number", "")

        # If profile already exists, just return it
        doc = _snap(db.collection('users').document(uid).get())
        if doc.exists:
            return success({"message": "Profile already exists", "user": doc.to_dict() or {}})

        required = ['name', 'role']
        for field in required:
            if not data.get(field):
                return error(f"'{field}' is required")

        user_doc = {
            'uid':        uid,
            'name':       data['name'].strip(),
            'email':      email.lower() if email else data.get('email', '').lower(),
            'phone':      phone if phone else data.get('phone', ''),
            'role':       data['role'],           # 'customer' or 'worker'
            'category':   data.get('category', '').lower(),
            'experience': int(data.get('experience', 0)),
            'rating':     5.0,
            'total_jobs': 0,
            'bio':        data.get('bio', ''),
            'city':       data.get('city', ''),
            'created_at': datetime.now(timezone.utc).isoformat(),
        }

        db.collection('users').document(uid).set(user_doc)
        return success({"message": "Profile created!", "user": user_doc}, 201)

    except Exception as e:
        return error(str(e), 500)


# ── 3. Get my profile (uses token, no email in URL) ──────────────────────────
@app.route('/auth/me', methods=['GET'])
@require_auth
def get_my_profile(**kwargs):
    try:
        uid = kwargs["decoded_token"]["uid"]
        doc = _snap(db.collection('users').document(uid).get())
        if not doc.exists:
            return error("Profile not found. Please complete setup.", 404)
        return success(doc.to_dict() or {})
    except Exception as e:
        return error(str(e), 500)


# ── 4. Update my profile ──────────────────────────────────────────────────────
@app.route('/auth/me', methods=['PUT'])
@require_auth
def update_my_profile(**kwargs):
    try:
        uid     = kwargs["decoded_token"]["uid"]
        data    = get_safe_json()
        allowed = ['name', 'phone', 'bio', 'city', 'experience', 'category']
        update_data = {k: data[k] for k in allowed if k in data}

        if not update_data:
            return error("No valid fields to update")

        db.collection('users').document(uid).update(update_data)
        return success({"message": "Profile updated!"})
    except Exception as e:
        return error(str(e), 500)


# ════════════════════════════════════════════════════════════════════════════
#  USER / WORKER PUBLIC ROUTES  (no auth needed — for browsing)
# ════════════════════════════════════════════════════════════════════════════

# ── 5. Get All Workers ────────────────────────────────────────────────────────
@app.route('/get-workers', methods=['GET'])
def get_workers():
    try:
        category = request.args.get('category', 'all')
        city     = request.args.get('city', '')

        query = db.collection('users').where('role', '==', 'worker')
        if category and category != 'all':
            query = query.where('category', '==', category.lower())

        workers_list = []
        for doc in query.stream():
            worker = doc.to_dict() or {}
            if city and worker.get('city', '').lower() != city.lower():
                continue
            workers_list.append(worker)

        workers_list.sort(key=lambda w: w.get('rating', 0), reverse=True)
        return success(workers_list)
    except Exception as e:
        return error(str(e), 500)


# ── 6. Get Single Worker ──────────────────────────────────────────────────────
@app.route('/worker/<uid>', methods=['GET'])
def get_worker(uid):
    try:
        doc = _snap(db.collection('users').document(uid).get())
        if not doc.exists:
            return error("Worker not found", 404)
        worker = doc.to_dict() or {}
        if worker.get('role') != 'worker':
            return error("This user is not a worker", 403)
        return success(worker)
    except Exception as e:
        return error(str(e), 500)


# ════════════════════════════════════════════════════════════════════════════
#  BOOKING ROUTES  (all protected)
# ════════════════════════════════════════════════════════════════════════════

# ── 7. Book a Worker ──────────────────────────────────────────────────────────
@app.route('/book-worker', methods=['POST'])
@require_auth
def book_worker(**kwargs):
    try:
        customer_uid = kwargs["decoded_token"]["uid"]
        data         = get_safe_json()

        required = ['worker_uid', 'date', 'service_type']
        for field in required:
            if not data.get(field):
                return error(f"'{field}' is required")

        worker_uid = data['worker_uid']
        worker_doc = _snap(db.collection('users').document(worker_uid).get())
        worker_data = worker_doc.to_dict() or {}
        if not worker_doc.exists or worker_data.get('role') != 'worker':
            return error("Invalid worker", 400)

        # Get customer info
        cust_doc  = _snap(db.collection('users').document(customer_uid).get())
        cust_data = cust_doc.to_dict() or {}

        booking_id = str(uuid.uuid4())[:8].upper()
        booking_doc = {
            'booking_id':      booking_id,
            'customer_uid':    customer_uid,
            'customer_email':  cust_data.get('email', ''),
            'customer_name':   cust_data.get('name', ''),
            'worker_uid':      worker_uid,
            'worker_email':    worker_data.get('email', ''),
            'worker_name':     worker_data.get('name', ''),
            'service_type':    data['service_type'],
            'date':            data['date'],
            'time_slot':       data.get('time_slot', ''),
            'address':         data.get('address', ''),
            'note':            data.get('note', ''),
            'status':          'pending',
            'is_rated':        False,
            'created_at':      datetime.now(timezone.utc).isoformat(),
        }

        db.collection('bookings').document(booking_id).set(booking_doc)
        return success({"message": "Booking sent!", "booking_id": booking_id}, 201)

    except Exception as e:
        return error(str(e), 500)


# ── 8. Update Booking Status ──────────────────────────────────────────────────
@app.route('/booking/<booking_id>/status', methods=['PUT'])
@require_auth
def update_booking_status(booking_id, **kwargs):
    try:
        caller_uid = kwargs["decoded_token"]["uid"]
        data       = get_safe_json()
        status     = data.get('status', '')

        valid_statuses = ['confirmed', 'completed', 'cancelled']
        if status not in valid_statuses:
            return error(f"Status must be one of: {valid_statuses}")

        doc_ref      = db.collection('bookings').document(booking_id)
        booking_snap = _snap(doc_ref.get())
        if not booking_snap.exists:
            return error("Booking not found", 404)

        booking_data = booking_snap.to_dict() or {}

        # Only the worker can confirm/complete; customer can cancel
        if status in ['confirmed', 'completed'] and booking_data.get('worker_uid') != caller_uid:
            return error("Only the assigned worker can confirm or complete a booking", 403)
        if status == 'cancelled' and caller_uid not in [
            booking_data.get('worker_uid'), booking_data.get('customer_uid')
        ]:
            return error("Not authorized to cancel this booking", 403)

        if booking_data.get('status') == 'completed' and status == 'completed':
            return error("Already completed", 400)

        doc_ref.update({'status': status, 'updated_at': datetime.now(timezone.utc).isoformat()})

        if status == 'completed':
            worker_ref = db.collection('users').document(booking_data['worker_uid'])
            worker_ref.update({'total_jobs': firestore.Increment(1)})  # type: ignore[attr-defined]

        return success({"message": f"Status updated to '{status}'"})
    except Exception as e:
        return error(str(e), 500)


# ── 9. My Bookings ────────────────────────────────────────────────────────────
@app.route('/my-bookings', methods=['GET'])
@require_auth
def my_bookings(**kwargs):
    try:
        uid  = kwargs["decoded_token"]["uid"]
        role = request.args.get('role', 'customer')   # ?role=worker  or  ?role=customer

        field   = 'worker_uid' if role == 'worker' else 'customer_uid'
        results = db.collection('bookings').where(field, '==', uid).stream()
        bookings = [doc.to_dict() or {} for doc in results]
        bookings.sort(key=lambda b: b.get('created_at', ''), reverse=True)
        return success(bookings)
    except Exception as e:
        return error(str(e), 500)


# ── 10. Rate a Worker ─────────────────────────────────────────────────────────
@app.route('/rate-worker', methods=['POST'])
@require_auth
def rate_worker(**kwargs):
    try:
        customer_uid = kwargs["decoded_token"]["uid"]
        data         = get_safe_json()
        booking_id   = data.get('booking_id', '')
        new_rating   = float(data.get('rating', 0))

        if not booking_id:
            return error("booking_id is required")
        if not (1 <= new_rating <= 5):
            return error("Rating must be between 1 and 5")

        booking_ref = db.collection('bookings').document(booking_id)
        booking_doc = _snap(booking_ref.get())
        if not booking_doc.exists:
            return error("Booking not found", 404)

        booking = booking_doc.to_dict() or {}

        # Only the customer who booked can rate
        if booking.get('customer_uid') != customer_uid:
            return error("You can only rate your own bookings", 403)
        if booking.get('status') != 'completed':
            return error("Job must be completed before rating")
        if booking.get('is_rated'):
            return error("Already rated", 409)

        worker_uid  = booking.get('worker_uid', '')
        worker_ref  = db.collection('users').document(worker_uid)
        worker_doc  = _snap(worker_ref.get())
        if not worker_doc.exists:
            return error("Worker not found", 404)

        worker     = worker_doc.to_dict() or {}
        old_rating = float(worker.get('rating', 5.0))
        total_jobs = int(worker.get('total_jobs', 0))

        updated_rating = new_rating if total_jobs == 0 else round(
            ((old_rating * (total_jobs - 1)) + new_rating) / total_jobs, 2
        )

        worker_ref.update({'rating': updated_rating})
        booking_ref.update({'is_rated': True})

        return success({"message": "Rating submitted!", "new_rating": updated_rating})
    except Exception as e:
        return error(str(e), 500)


# ════════════════════════════════════════════════════════════════════════════
#  RUN
# ════════════════════════════════════════════════════════════════════════════



# ════════════════════════════════════════════════════════════════════════════
#  ADMIN ROUTES
#  Protected by X-Admin-Key header — set ADMIN_SECRET in env or below
#  Usage: every admin API call must send:  X-Admin-Key: your_secret_key
# ════════════════════════════════════════════════════════════════════════════

ADMIN_SECRET = "sewanow-admin-2024"

def require_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        key = request.headers.get("X-Admin-Key", "")
        if key != ADMIN_SECRET:
            return error("Unauthorized", 401)
        return f(*args, **kwargs)
    return decorated


# ── Admin: Overview stats ─────────────────────────────────────────────────────
@app.route('/admin/stats', methods=['GET'])
@require_admin
def admin_stats():
    try:
        # All users
        all_users   = [d.to_dict() or {} for d in db.collection('users').stream()]
        all_bookings = [d.to_dict() or {} for d in db.collection('bookings').stream()]

        total_users    = len(all_users)
        total_workers  = sum(1 for u in all_users if u.get('role') == 'worker')
        total_customers = sum(1 for u in all_users if u.get('role') == 'customer')

        total_bookings   = len(all_bookings)
        pending_bookings  = sum(1 for b in all_bookings if b.get('status') == 'pending')
        confirmed_bookings = sum(1 for b in all_bookings if b.get('status') == 'confirmed')
        completed_bookings = sum(1 for b in all_bookings if b.get('status') == 'completed')
        cancelled_bookings = sum(1 for b in all_bookings if b.get('status') == 'cancelled')

        return success({
            "users": {
                "total":     total_users,
                "workers":   total_workers,
                "customers": total_customers,
            },
            "bookings": {
                "total":     total_bookings,
                "pending":   pending_bookings,
                "confirmed": confirmed_bookings,
                "completed": completed_bookings,
                "cancelled": cancelled_bookings,
            }
        })
    except Exception as e:
        return error(str(e), 500)
    
    
#frontend request handle kar sake:
@app.route('/admin/update-booking/<booking_id>', methods=['POST'])
@require_admin
def update_booking(booking_id):
    new_status = request.json.get('status')
    # Yahan apna database update logic likho (e.g., MongoDB/SQL update)
    # booking = db.bookings.find_one_and_update({'booking_id': booking_id}, {'$set': {'status': new_status}})
    return jsonify({"success": True})

# ── Admin: Bookings per day (last 30 days) ────────────────────────────────────
@app.route('/admin/bookings-trend', methods=['GET'])
@require_admin
def admin_bookings_trend():
    try:
        all_bookings = [d.to_dict() or {} for d in db.collection('bookings').stream()]
        from collections import defaultdict
        daily = defaultdict(int)
        for b in all_bookings:
            created = b.get('created_at', '')
            if created:
                day = created[:10]   # YYYY-MM-DD
                daily[day] += 1

        sorted_days = sorted(daily.items())[-90:]   # last 90 days
        return success([{"date": d, "count": c} for d, c in sorted_days])
    except Exception as e:
        return error(str(e), 500)


# ── Admin: Top workers by jobs + rating ──────────────────────────────────────
@app.route('/admin/top-workers', methods=['GET'])
@require_admin
def admin_top_workers():
    try:
        workers = [
            d.to_dict() or {}
            for d in db.collection('users').where('role', '==', 'worker').stream()
        ]
        workers.sort(key=lambda w: (w.get('total_jobs', 0), w.get('rating', 0)), reverse=True)
        top = workers[:10]
        result = [{
            "name":       w.get('name', ''),
            "category":   w.get('category', ''),
            "city":       w.get('city', ''),
            "total_jobs": w.get('total_jobs', 0),
            "rating":     w.get('rating', 0),
        } for w in top]
        return success(result)
    except Exception as e:
        return error(str(e), 500)


# ── Admin: Bookings by service category ──────────────────────────────────────
@app.route('/admin/bookings-by-category', methods=['GET'])
@require_admin
def admin_bookings_by_category():
    try:
        all_bookings = [d.to_dict() or {} for d in db.collection('bookings').stream()]
        from collections import defaultdict
        cats = defaultdict(int)
        for b in all_bookings:
            cats[b.get('service_type', 'other')] += 1
        return success([{"category": k, "count": v} for k, v in sorted(cats.items(), key=lambda x: -x[1])])
    except Exception as e:
        return error(str(e), 500)


# ── Admin: Recent bookings (last 20) ─────────────────────────────────────────
@app.route('/admin/recent-bookings', methods=['GET'])
@require_admin
def admin_recent_bookings():
    try:
        all_bookings = [d.to_dict() or {} for d in db.collection('bookings').stream()]
        all_bookings.sort(key=lambda b: b.get('created_at', ''), reverse=True)
        return success(all_bookings[:20])
    except Exception as e:
        return error(str(e), 500)


# ── Admin: All users list ─────────────────────────────────────────────────────
@app.route('/admin/users', methods=['GET'])
@require_admin
def admin_users():
    try:
        role = request.args.get('role', '')
        query = db.collection('users')
        if role:
            query = query.where('role', '==', role)
        users = [d.to_dict() or {} for d in query.stream()]
        users.sort(key=lambda u: u.get('created_at', ''), reverse=True)
        return success(users)
    except Exception as e:
        return error(str(e), 500)


if __name__ == '__main__':
    app.run(debug=True, port=5000)