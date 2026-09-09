import cv2
import face_recognition

# Open your Mac's built-in camera
cap = cv2.VideoCapture(0)

print("Camera started. Press Q to quit.")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    # Convert to RGB (face_recognition needs RGB, OpenCV uses BGR)
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    # Detect all faces in the frame
    face_locations = face_recognition.face_locations(rgb_frame)

    # Draw a box around each face
    for (top, right, bottom, left) in face_locations:
        cv2.rectangle(frame, (left, top), (right, bottom), (0, 255, 0), 2)
        cv2.putText(frame, "Face Detected", (left, top - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

    # Show how many faces are detected
    cv2.putText(frame, f"Faces: {len(face_locations)}", (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

    cv2.imshow("Attendify - Face Detection Test", frame)

    # Press Q to quit
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
print("Camera stopped.")
