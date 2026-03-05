import math

def calculate_handles(sx, sy, tx, ty):
    dx = tx - sx
    dy = ty - sy
    
    is_main = True
    sh = 'bottom-source'
    th = 'top-target'
    
    # EXACT LOGIC FROM REACT
    is_horizontal = abs(dx) > abs(dy)
    if is_horizontal:
        is_main = False
        if dx > 0:
            sh = 'right-source'
            th = 'left-target'
        else:
            sh = 'left-source'
            th = 'right-target'
    else:
        if dy < 0:
            sh = 'top-source'
            th = 'bottom-target'
            
    print(f"Source({sx},{sy}) -> Target({tx},{ty}) | dx={dx}, dy={dy} | isHoriz={is_horizontal} | {sh} -> {th}")

print("Green -> Blue")
calculate_handles(0, 0, 0, 160)

print("\nWhat if Dagre placed Green at -320?")
calculate_handles(-320, 0, 0, 160)

print("\nWhat if Dagre placed Green at 320?")
calculate_handles(320, 0, 0, 160)

print("\nBlue -> Pending Bottom")
calculate_handles(0, 160, 0, 320)

print("\nBlue -> Pending Right")
calculate_handles(0, 160, 320, 160)
